const fs = require('fs');
const yaml = require('js-yaml');
const mkdirp = require('mkdirp-promise');
const readdirrec = require('readdirrec');
const { promisify } = require('util');
const { basename, dirname, join, relative } = require('path');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const defaults = {
  contentPath: 'content',
  templatesPath: 'templates',
  publishPath: 'publish',
  assetsPath: 'assets',

  defaultTemplate: 'index.html',
  contentExtension: '.html',
  publishExtension: '.html',

  contextRegex: /^([\s\S]*?)\n---\n/,
  hiddenRegex: /^_/,

  plugins: [],
  context: {},
  cwd: process.cwd(),
};

function corePlugin(config) {
  return {
    async beforeRead(document) {
      const source = await readFile(document.contentPath, 'utf8');
      const matchContext = source.match(config.contextRegex);
      let content = source;

      if (matchContext) {
        try {
          Object.assign(document.context, yaml.safeLoad(matchContext[1]));
          content = source.substr(matchContext[0].length);
        } catch (e) {
          //
        }
      }

      return { ...document, source, content };
    },
    async beforeAsset(asset) {
      const buffer = await readFile(asset.assetPath);
      await mkdirp(dirname(asset.publishPath));
      writeFile(asset.publishPath, buffer);
    },
  };
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

      if (ctx) {
        try {
          Object.assign(context, yaml.safeLoad(ctx));
        } catch (e) {
          //
        }
      }
    }));

    return context;
  }

  function runPlugins(hook, initialData, ...args) {
    let stop = false;

    return config.plugins.concat(corePlugin(config)).reduce(async (p, plugin) => {
      const currentData = await p;

      if (!plugin[hook] || stop) return currentData;

      // eslint-disable-next-line no-use-before-define
      const newData = await plugin[hook].call(site, currentData, ...args);

      if (newData === undefined) {
        return currentData;
      }

      if (newData === null) {
        stop = true;
        return currentData;
      }

      return newData;
    }, initialData);
  }

  const site = {
    config(options) {
      if (options) Object.assign(config, options);
      return { ...config };
    },

    use(...plugins) {
      config.plugins.push(...plugins);
    },

    async create(path, context, content) {
      const filename = basename(path, config.contentExtension);
      const contentDir = dirname(join(paths().content, path));
      const contentPath = join(contentDir, `${filename}${config.contentExtension}`);
      const source = `${context ? `${yaml.safeDump(context)}---\n` : ''}${content}`;

      let document = {
        contentPath,
        context,
        source,
        content,
      };

      document = await runPlugins('beforeCreate', document);

      if (!document) return null;

      await mkdirp(contentDir);
      await writeFile(contentPath, source, { flag: 'wx' });

      await runPlugins('afterCreate', document);

      return document;
    },

    async read(path) {
      const contentDir = dirname(join(paths().content, path));
      const publishDir = dirname(join(paths().publish, path));
      const filename = basename(path, config.contentExtension);
      const contentPath = join(contentDir, `${filename}${config.contentExtension}`);
      const publishPath = join(publishDir, `${filename}${config.publishExtension}`);

      let document = {
        contentPath,
        publishPath,
        context: { ...config.context },
      };

      document = await runPlugins('beforeRead', document);

      if (!document) return null;

      const template = document.context.template || config.defaultTemplate;
      const templatePath = join(paths().templates, template);

      document = { ...document, templatePath };
      await runPlugins('afterRead', document);

      documents[path] = document;

      return document;
    },

    async update(path, ctx, content) {
      let document = documents[path];
      let context = { ...ctx };

      if (!document) throw new Error();

      document = await runPlugins('beforeUpdate', document, context, content);

      if (!document) return null;
      if (context) context = Object.assign(document.context, context);
      if (typeof content === 'string') document.content = content;

      document.source = `${context ? `${yaml.safeDump(context)}---\n` : ''}${document.content}`;

      await runPlugins('afterUpdate', document);

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

      await Promise.all([
        unlink(contentPath),
        unlink(publishPath).catch(() => null),
      ]);
    },

    async readAll() {
      await runPlugins('beforeReadAll');

      const pathlist = await readdirrec(paths().content, {
        filter: { ext: config.contentExtension },
      });

      const doclist = await Promise.all(pathlist.map(contentPath => {
        const path = relative(paths().content, contentPath);
        const dir = dirname(contentPath);

        if (!contexts[dir]) {
          contexts[dir] = {};

          loadContext(dir).then(context => {
            contexts[dir] = context;
          });
        }

        return this.read(path);
      }));

      await runPlugins('afterReadAll');

      return doclist;
    },

    async build(path) {
      let document = documents[path];

      if (!document) throw new Error();

      const publishDir = dirname(document.publishPath);
      const context = {
        ...document.context,
        filename: basename(document.publishPath),
        root: relative(publishDir, paths().publish) || '.',
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
      const template = await readFile(document.templatePath, 'utf8');

      document = await runPlugins('beforeBuild', document, template);

      if (!document) return null;

      await runPlugins('afterBuild', document);

      built[path] = document;

      return document;
    },

    async buildAll() {
      await runPlugins('beforeBuildAll');

      const doclist = await Promise.all(Object.keys(documents).map(this.build));

      await runPlugins('afterBuildAll');

      return doclist;
    },

    async write(path) {
      let document = built[path];

      if (!document) throw new Error();

      document = await runPlugins('beforeWrite', document);

      if (!document) return null;

      await mkdirp(dirname(document.publishPath));
      await writeFile(document.publishPath, document.content);

      await runPlugins('afterWrite', document);

      return document.publishPath;
    },

    async writeAll() {
      await runPlugins('beforeWriteAll');

      const pathlist = await Promise.all(Object.keys(built).map(this.write));

      await runPlugins('afterWriteAll');

      return pathlist;
    },

    async handleAssets() {
      const assets = await readdirrec(paths().assets);

      await mkdirp(paths().publish);

      return Promise.all(assets.map(async assetPath => {
        const publishPath = join(paths().publish, relative(paths().assets, assetPath));
        let asset = { assetPath, publishPath };

        asset = await runPlugins('beforeAsset', asset);

        if (!asset) return;

        await runPlugins('afterAsset', asset);
      }));
    },

    list() {
      return { ...documents };
    },

    async run() {
      await this.readAll();
      await this.buildAll();
      await this.writeAll();
      await this.handleAssets();
    },
  };

  return site;
}

module.exports = statiq;
