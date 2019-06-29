const { promisify } = require('util');
const { basename, dirname, extname, join, relative } = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const mkdirp = require('mkdirp-promise');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

const defaults = {
  contentPath: 'content',
  templatesPath: 'templates',
  publishPath: 'publish',
  assetsPath: 'assets',

  defaultTemplate: 'index.html',
  contentExtension: '.md',
  publishExtension: '.html',

  contextRegex: /^([\s\S]*?)\n---\n/,
  hiddenRegex: /^_/,

  plugins: [],
  context: {sitename:1,year:2},
  cwd: process.cwd(),
};

function runPlugins(plugins, event, ...args) {
  let stop = false;

  return plugins.reduce((args, next) => {
    if (stop || !next[event]) return args;

    let ret = next[event](...args);

    if (!ret) stop = true;

    return ret || args;
  }, args);
}

function statiq(opts = {}) {
  const config = { ...defaults, ...opts };
  const documents = {};
  const contexts = {};
  const built = {};

  function paths() {
    return {
      content: join(config.cwd, config.contentPath),
      templates: join(config.cwd, config.templatesPath),
      publish: join(config.cwd, config.publishPath),
      assets: join(config.cwd, config.assetsPath),
    };
  }

  async function loadContext(dir) {
    const file = join(dir, 'config');
    const context = {};
    
    await Promise.all(['.json', '.yaml', '.yml'].map(async ext => {
      const ctx = await readFile(`${file}${ext}`, 'utf8').catch(() => null);
      
      if (ctx) try {
        Object.assign(context, yaml.safeLoad(ctx));
      } catch (e) {}
    }));

    return context;
  }

  return {
    config(options) {
      if (options) Object.assign(config, options);
      return { ...config };
    },

    use(...plugins) {
      config.plugins.push(...plugins);
    },

    async create(...args) {
      const [path, context, content] = runPlugins(config.plugins, 'beforeCreate', ...args);
      const dir = dirname(join(paths().content, path));
      const filename = basename(path, config.contentExtension);
      const target = join(dir, `${filename}${config.contentExtension}`);
      const source = `${context ? yaml.safeDump(context) + '---\n' : ''}${content}`;

      await mkdirp(dir);
      await writeFile(target, source, { flag: 'wx' });

      runPlugins(config.plugins, 'afterCreate', target);

      return target;
    },

    async read(path) {
      const contentDir = dirname(join(paths().content, path));
      const publishDir = dirname(join(paths().publish, path));
      const filename = basename(path, config.contentExtension);
      const contentPath = join(contentDir, `${filename}${config.contentExtension}`);
      const publishPath = join(publishDir, `${filename}${config.publishExtension}`);
      const source = await readFile(contentPath, 'utf8');
      const matchContext = source.match(config.contextRegex);
      let context = { ...config.context };
      let content = source;

      if (matchContext) {
        try {
          Object.assign(context, yaml.safeLoad(matchContext[1]));
          content = source.substr(matchContext[0].length);
        } catch(e) {}
      }

      const template = context.template || config.defaultTemplate;
      const templatePath = join(paths().templates, template);

      [path, context, content] = runPlugins(config.plugins, 'afterRead', path, context, content);

      return documents[path] = {
        contentPath,
        publishPath,
        templatePath,
        source,
        context,
        content,
      };
    },

    async update(...args) {
      let [path, context, content] = runPlugins(config.plugins, 'beforeUpdate', ...args);
      const document = documents[path];

      if (!document) throw new Error();
      if (context) context = Object.assign(document.context, context);
      if (typeof content === 'string') document.content = content;

      [path, context, content] = runPlugins(config.plugins, 'afterUpdate', path, context, content);

      document.source = `${context ? yaml.safeDump(context) + '---\n' : ''}${content}`;

      return document;
    },

    async delete(path) {
      const contentDir = dirname(join(paths().content, path));
      const publishDir = dirname(join(paths().publish, path));
      const filename = basename(path, config.contentExtension);
      const contentPath = join(contentDir, `${filename}${config.contentExtension}`);
      const publishPath = join(publishDir, `${filename}${config.publishExtension}`);

      delete documents[path];
      delete built[path];
  
      return Promise.all([
        unlink(contentPath),
        unlink(publishPath).catch(() => null),
      ]);
    },

    async scan(path = '') {
      const fullpath = join(paths().content, path);
      const st = await stat(fullpath);

      if (st.isDirectory()) {
        const context = await loadContext(fullpath);

        if (context) contexts[path] = context;

        const list = await readdir(fullpath);
        
        return Promise.all(list.map(file => this.scan(join(path, file))));
      }

      if (st.isFile() && extname(path) === config.contentExtension) {
        return this.read(path);
      }
    },

    async build(path) {
      let document = documents[path];
      
      if (!document) throw new Error();
      
      const publishDir = dirname(document.publishPath);
      const context = {
        ...document.context,
        filename: basename(document.publishPath),
        root: relative(publishDir, paths().publish),
        index: {},
      };

      Object.entries(documents).forEach(([p, doc]) => {
        const dir = dirname(p);

        if (config.hiddenRegex.test(basename(doc.publishPath))) return;
        if (!context.index[dir]) context.index[dir] = [];
        
        context.index[dir].push({
          ...doc.context,
          path: relative(publishDir, doc.publishPath),
          current: doc.publishPath === document.publishPath,
        });
      });
      
      document = { ...document, context };
      let template = await readFile(document.templatePath, 'utf8');

      [document, template] = runPlugins(config.plugins, 'beforeBuild', document, template);
      [document, template] = runPlugins(config.plugins, 'afterBuild', document, template);

      return built[path] = document;
    },

    async buildAll() {
      return Promise.all(Object.keys(documents).map(this.build));
    },

    async write(path) {
      const document = built[path];

      if (!document) throw new Error();

      await mkdirp(dirname(document.publishPath));
      await writeFile(document.publishPath, document.content);

      return document.publishPath;
    },

    async writeAll() {
      return Promise.all(Object.keys(built).map(this.write));
    },

    list() {
      return { ...documents };
    },

    run() {
      return this.scan()
        .then(() => this.buildAll())
        .then(() => this.writeAll());
    },
  };
}

module.exports = statiq;
