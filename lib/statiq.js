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

function replaceExt(file, oldext, newext) {
  return path.join(path.dirname(file), path.basename(file, oldext) + (newext || oldext));
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
    this._config = Object.assign({}, defaults);
    this._cachedContexts = {};
    this._cachedDocuments = {};
    this._cachedAssets = {};
  }

  /**
   * Get full path to source, publish or asset directory
   * @param  {string} dir      directory to get the path to
   * @param  {string} relative get path relative to this
   * @return {string}          full path
   */
  _path(dir, relative = '') {
    return relative
      ? path.relative(path.join(this._config.cwd, this._config.paths[dir]), relative) || '.'
      : path.join(this._config.cwd, this._config.paths[dir]);
  }

  /**
   * Get the directory agnostic file path
   * @param  {string} file full path
   * @return {string}      document path
   */
  _base(file) {
    if (file.startsWith(this._path('content'))) {
      return this._path('content', file);
    }

    if (file.startsWith(this._path('publish'))) {
      return this._path('publish', file);
    }

    if (file.startsWith(this._path('templates'))) {
      return this._path('templates', file);
    }

    if (file.startsWith(this._path('assets'))) {
      return this._path('assets', file);
    }

    return file;
  }

  /**
   * Merge context and parent contexts for a path
   * @param  {string} dir directory to start from
   * @return {object}     resulting context object
   */
  _mergeContexts(dir) {
    const contexts = [];

    do {
      if (this._cachedContexts[dir]) {
        contexts.unshift(this._cachedContexts[dir]);
      }

      dir = path.dirname(dir);
    } while (dir !== '.' && dir !== '/');

    contexts.unshift({}, this._config.context);

    return Object.assign.apply(null, contexts);
  }

  /**
   * Configure
   * @param  {object} options
   */
  config(options) {
    Object.assign(this._config, options);
    return this;
  }

  /**
   * Basic extensibility
   * @param  {function} plugin
   */
  use(plugin) {
    plugin(this);
    return this;
  }

  /**
   * Create a document
   * @param  {string} file    document path
   * @param  {object} context document context object
   * @param  {string} content document content
   * @return {promise}        resolved with full path
   */
  create(file, context, content = '') {
    const config = this._config;
    const documentPath = this._base(file);
    const sourcePath = path.join(this._path('content'), replaceExt(documentPath, config.contentExtension));

    return new Promise((resolve, reject) => {
      mkdirp(path.dirname(sourcePath), err => {
        if (err) return reject(err);

        const data = (context ? yaml.safeDump(context) + '---\n' : '') + content;

        fs.writeFile(sourcePath, data, { flag: 'wx' }, err => {
          if (err) return reject(err);

          resolve(sourcePath);
        });
      });
    });
  }

  /**
   * Read a document
   * @param  {string} file document path
   * @return {promise}     resolved with document object
   */
  read(file) {
    const config = this._config;
    const documentPath = this._base(file);
    const sourcePath = path.join(this._path('content'), replaceExt(documentPath, config.contentExtension));
    const publishPath = path.join(this._path('publish'), replaceExt(documentPath, config.contentExtension, config.publishExtension));
    const rawContext = this._mergeContexts(path.dirname(documentPath));

    return new Promise((resolve, reject) => {
      fs.readFile(sourcePath, 'utf8', (err, rawContent) => {
        if (err) return reject(err);

        const matchContext = rawContent.match(config.contextRegex);

        if (matchContext) {
          try {
            Object.assign(rawContext, yaml.safeLoad(matchContext[1]));
            rawContent = rawContent.substr(matchContext[0].length);
          } catch(e) {}
        }

        const blocks = {};
        const templatePath = path.join(this._path('templates'), rawContext.template || config.defaultTemplate);
        const context = config.contextHandler(rawContext, sourcePath, publishPath);
        const content = config.contentParser(rawContent.replace(config.blocksRegex, (match, id, block) => {
          blocks[id] = block.trim();
          return '';
        }).trim());

        Object.keys(blocks).forEach(id => {
          Object.assign(context, { [id]: config.contentParser(blocks[id]) });
        });
        
        resolve({
          documentPath,
          sourcePath,
          publishPath,
          templatePath,
          rawContext,
          rawContent,
          context,
          content,
        });
      });
    });
  }

  /**
   * Update an existing document
   * @param  {string} file    document path
   * @param  {object} context document context object
   * @param  {string} content document content
   * @return {promise}        resolved with full path
   */
  update(file, context, content) {
    const config = this._config;
    const documentPath = this._base(file);
    const sourcePath = this._path('content', replaceExt(documentPath, config.contentExtension));

    return new Promise((resolve, reject) => {
      fs.open(sourcePath, 'r+', (err, fd) => {
        if (err) return reject(err);

        const data = (context ? yaml.safeDump(context) + '---\n' : '') + content;

        fs.write(fd, data, err => {
          if (err) return reject(err);

          fs.close(fd, err => {
            if (err) return reject(err);            
            
            resolve(sourcePath);
          });
        });
      });
    });
  }

  /**
   * Delete a document
   * @param  {string} file document path
   * @return {promise}
   */
  delete(file) {
    const config = this._config;
    const documentPath = this._base(file);
    const sourcePath = this._path('content', replaceExt(documentPath, config.contentExtension));

    return new Promise((resolve, reject) => {
      fs.unlink(sourcePath, err => {
        if (err) return reject(err);

        resolve();
      });
    });
  }

  /**
   * Try to load a context file from a directory
   * @param  {string} dir directory to search in
   * @return {promise}    context object if found
   */
  loadContext(dir) {
    const file = path.join(dir, 'context');

    return Promise.all(['.json', '.yaml', '.yml', '.conf'].map(ext => {
      return new Promise(resolve => {
        fs.readFile(file + ext, 'utf8', (err, context) => {
          if (err) return resolve();

          resolve(yaml.safeLoad(context));
        });
      });
    })).then(contexts => contexts.find(context => context));
  }

  /**
   * Deep scan a directory and cache all the document objects
   * @param  {string} dir directory path
   * @return {promise}    resolves with the cached documents
   */
  scan(dir = this._path('content')) {
    const config = this._config;
    const documentPath = this._base(dir);
    
    return new Promise((resolve, reject) => {
      fs.stat(dir, (err, stat) => {
        if (err) return reject(err);

        if (stat.isDirectory()) {
          this.loadContext(dir).then(context => {
            if (context) this._cachedContexts[documentPath] = context;
          });

          fs.readdir(dir, (err, files) => {
            if (err) return reject(err);

            Promise.all(
              files.map(file => this.scan(path.join(dir, file)))
            ).then(() => resolve(this._cachedDocuments)).catch(err => reject(err));
          });
        } else if (stat.isFile() && path.extname(dir) === config.contentExtension) {
          this.read(dir).then(document => {
            this._cachedDocuments[documentPath] = document;
            resolve();
          });
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Clear cache
   * @return {promise}
   */
  clear() {
    this._cachedDocuments = {};
    this._cachedContexts = {};
    this._cachedAssets = {};

    return Promise.resolve();
  }

  /**
   * Build a document
   * @param  {string} file document path
   * @return {promise}     resolves with full path
   */
  build(file) {
    const config = this._config;

    return new Promise(resolve => {
      const document = this._cachedDocuments[file];

      if (document) return resolve(document);

      return this.read(file);
    }).then(document => {
      const dirname = path.dirname(document.publishPath);
      const context = Object.assign({}, document.context, {
        filename: path.basename(document.publishPath),
        root: path.relative(dirname, this._path('publish')) || '.',
        index: {},
      });

      Object.keys(this._cachedDocuments).forEach(f => {
        const doc = this._cachedDocuments[f];
        const dir = path.dirname(f);

        if (config.hiddenRegex.test(path.basename(doc.sourcePath))) return;
        if (!context.index[dir]) context.index[dir] = [];

        context.index[dir].push(Object.assign({}, doc.context, {
          path: path.relative(dirname, doc.publishPath),
          current: f.sourcePath === document.sourcePath,
        }));
      });

      context.index = config.indexHandler(context.index, document.sourcePath, document.publishPath);

      return Object.assign({}, document, { context });
    }).then(document => {
      return new Promise((resolve, reject) => {
        fs.readFile(document.templatePath, 'utf8', (err, template) => {
          if (err) return reject(err);

          new Promise(r => {
            r(config.templateParser(template, document));
          }).then(data => {
            mkdirp(path.dirname(document.publishPath), err => {
              if (err) return reject(err);

              fs.writeFile(document.publishPath, data, err => {
                if (err) return reject(err);

                resolve(document.publishPath);
              });
            });
          }).catch(reject);
        });
      });
    });
  }

  /**
   * Build all files in cache
   * @return {promise}
   */
  buildAll() {
    return Promise.all(Object.keys(this._cachedDocuments).map(this.build));
  }

  /**
   * Copy asset to publish dir
   * @param  {string} asset asset path
   * @return {promise}      resolves with full path
   */
  copyAsset(asset) {
    const config = this._config;
    const sourcePath = path.join(this._path('assets'), asset);
    const publishPath = path.join(this._path('publish'), asset);

    return new Promise((resolve, reject) => {
      mkdirp(path.dirname(publishPath), err => {
        if (err) return reject(err);

        resolve(config.assetHandler(sourcePath, publishPath));
      });
    });
  }

  /**
   * Copy all assets from a dir to publish dir
   * @param  {string} dir directory to scan
   * @return {promise}
   */
  copy(dir = this._path('assets')) {
    return new Promise((resolve, reject) => {
      fs.stat(dir, (err, stat) => {
        if (err) return reject(err);

        if (stat.isDirectory()) {
          fs.readdir(dir, (err, files) => {
            if (err) return reject(err);

            Promise.all(
              files.map(file => this.copy(path.join(dir, file)))
            ).then(() => resolve()).catch(err => reject(err));
          })
        } else {
          this.copyAsset(this._base(dir)).then(() => resolve());
        }
      });
    });
  }

  /**
   * Scan and build all files
   * @return {promise}
   */
  run() {
    return this.clear().then(this.scan).then(this.buildAll);
  }
}

module.exports = new Statiq();
module.exports.Constructor = Statiq;
