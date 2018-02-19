const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const mkdirp = require('mkdirp');

function identity(a) {
  return a;
}

function simpleParser(template, data) {
  return Object.keys(data || {}).reduce((result, key) => (
    result.replace(new RegExp('{{' + key + '}}', 'g'), data[key])
  ), template);
}

function syncCopy(source, target) {
  fs.writeFileSync(target, fs.readFileSync(source));
  return target;
}

const defaults = {
  paths: {
    content: 'content',
    templates: 'templates',
    publish: 'public',
    assets: 'assets',
  },
  defaultTemplate: 'index.html',
  contentExtension: '.md',
  publishExtension: '.html',
  contextRegex: /^([\s\S]*?)\n---\n/,
  blocksRegex: /^<<([a-z0-9]+)\n([\s\S]+)\n\1;$/gm,
  hiddenRegex: /^_/,
  contentParser: identity,
  templateParser: simpleParser,
  contextHandler: identity,
  indexHandler: identity,
  assetHandler: syncCopy,
  context: {},
  cwd: null,
};

class Statiq {
  constructor() {
    this._index = [];
    this._config = Object.assign({}, defaults);
    this._contexts = {};
  }

  config(options) {
    Object.assign(this._config, options);
  }

  path(dir, relative) {
    return relative
      ? path.relative(path.join(this._config.cwd, this._config.paths[dir]), relative) || '.'
      : path.join(this._config.cwd, this._config.paths[dir]);
  }

  add(filepath, context) {
    const config = this._config;
    const dirname = path.dirname(filepath);
    const filename = path.basename(filepath, config.contentExtension);
    const target = path.join(this.path('content'), dirname, filename + config.contentExtension);

    return new Promise((resolve, reject) => {
      if (fs.existsSync(target)) {
        reject(target + ' already exists');
      } else {
        mkdirp(path.dirname(target), err => {
          if (err) return reject(err);
          fs.writeFileSync(target, context ? (yaml.safeDump(context) + '---\n') : '');
          resolve(target);
        });
      }
    });
  }

  update(filepath, content, context) {
    const config = this._config;
    const dirname = path.dirname(filepath);
    const filename = path.basename(filepath, config.contentExtension);
    const target = path.join(this.path('content'), dirname, filename + config.contentExtension);

    return new Promise((resolve, reject) => {
      if (!fs.existsSync(target)) {
        reject(target + ' does not exist');
      } else {
        mkdirp(path.dirname(target), err => {
          if (err) return reject(err);
          fs.writeFileSync(target, (context ? (yaml.safeDump(context) + '---\n') : '') + content);
          resolve(this._index.find(f => f.source === filepath));
        });
      }
    });
  }

  copyAsset(asset) {
    const config = this._config;
    const source = path.join(this.path('assets'), asset);
    const target = path.join(this.path('publish'), asset);

    return new Promise((resolve, reject) => {
      mkdirp(path.dirname(asset), err => {
        if (err) return reject(err);
        resolve(config.assetHandler(source, target));
      });
    });
  }

  copy(dir) {
    if (!dir) dir = this.path('assets');

    const stat = fs.statSync(dir);

    if (stat.isDirectory()) {
      return Promise.all(fs.readdirSync(dir).map(file => this.copy(path.join(dir, file))));
    }

    return this.copyAsset(this.path('assets', dir));
  }

  scan(dir, index = []) {
    if (!dir) dir = this.path('content');

    const config = this._config;
    const stat = fs.statSync(dir);

    if (stat.isDirectory()) {
      this.loadContext(dir);
      fs.readdirSync(dir).forEach(file => this.scan(path.join(dir, file), index));
    } else if (stat.isFile() && path.extname(dir) === config.contentExtension) {
      index.push(this.loadFile(dir));
    }

    this._index = index;

    return Promise.resolve(index);
  }

  mergeContexts(dir) {
    const contexts = [];

    do {
      if (this._contexts[dir]) {
        contexts.unshift(this._contexts[dir]);
      }
      dir = path.dirname(dir);
    } while (dir !== '.');

    contexts.unshift({}, this._config.context);

    return Object.assign.apply(null, contexts);
  }

  loadContext(dir) {
    const filepath = path.join(dir, 'context');
    const dirname = this.path('content', dir);

    ['.json', '.yaml', '.yml', '.conf'].some(ext => {
      if (fs.existsSync(filepath + ext)) {
        return this._contexts[dirname] = yaml.safeLoad(fs.readFileSync(filepath + ext, 'utf8'));
      }
    });

    return null;
  }

  loadFile(file) {
    const config = this._config;
    const filename = path.basename(file);
    const dirname = this.path('content', path.dirname(file));
    const source = path.join(dirname, filename);
    const target = path.join(dirname, path.basename(filename, config.contentExtension) + config.publishExtension);
    const blocks = {};

    let context = this.mergeContexts(dirname);
    let document = fs.readFileSync(file, 'utf8');

    const match = document.match(config.contextRegex);

    if (match) {
      try {
        Object.assign(context, yaml.safeLoad(match[1]));
        document = document.substr(match[0].length);
      } catch(e) {}
    }

    document = document.replace(config.blocksRegex, (match, id, content) => {
      blocks[id] = content.trim();
      return '';
    }).trim();

    context = config.contextHandler(context, source, target);

    return { source, target, filename, dirname, context, blocks, document };
  }

  buildFile(file) {
    const index = this._index;
    const config = this._config;
    const templatesDir = this.path('templates');
    const publishDir = this.path('publish');
    const target = path.join(publishDir, file.target);
    const template = path.join(templatesDir, file.context.template || config.defaultTemplate);
    const context = Object.assign({}, file.context, {
      document: config.contentParser(file.document),
      filename: file.filename,
      root: path.relative(file.dirname, '.') || '.',
      index: {},
      template
    });

    Object.keys(file.blocks).forEach(id => {
      Object.assign(context, { [id]: config.contentParser(file.blocks[id]) });
    });

    index.forEach(f => {
      if (config.hiddenRegex.test(f.filename)) return;
      if (!context.index[f.dirname]) context.index[f.dirname] = [];

      context.index[f.dirname].push(Object.assign({}, f.context, {
        path: path.relative(file.dirname, f.target),
        current: file.source === f.source,
      }));
    });

    context.index = config.indexHandler(context.index, file.source, file.target);

    return new Promise((resolve, reject) => {
      return Promise.resolve(config.templateParser(fs.readFileSync(template, 'utf8'), context))
        .then(result => {
          mkdirp(path.dirname(target), err => {
            if (err) return reject(err);
            fs.writeFile(target, result, err => {
              if (err) return reject(err);
              resolve(target);
            });
          });
        });
    });
  }

  build() {
    return Promise.all(this._index.map(f => this.buildFile(f)));
  }

  run() {
    return this.scan().then(() => this.build());
  }
}

module.exports = new Statiq();
module.exports.Constructor = Statiq;
