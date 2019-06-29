const fs = require('fs');
const path = require('path');
const util = require('util');

function blocksPlugin(opts = {}) {
  const config = {
    regex: /^<<([a-z0-9]+)\n([\s\S]+)\n\1;$/gim,
    ...opts,
  };

  return {
    beforeBuild(document) {
      document.content = document.content.replace(config.regex, (match, id, block) => {
        document.context[id] = block.trim();
        return '';
      }).trim();

      return document;
    },
  };
}

function markedPlugin(opts = {}) {
  const marked = require('marked');
  const config = {
    parseMultilineContext: true,
    ...opts,
  };

  return {
    beforeBuild(document) {
      const content = marked(document.content);
      const context = { ...document.context };

      if (config.parseMultilineContext) {
        Object.entries(context).forEach(([key, value]) => {
          if (typeof value !== 'string') return;
          if (value.indexOf('\n') === -1) return;

          context[key] = marked(value);
        });
      }

      return { ...document, context, content };
    }
  }
}

function lessPlugin(opts = {}) {
  const less = require('less');

  return {
    async beforeAsset(asset) {
      if (path.extname(asset.assetPath) !== '.less') return asset;

      const basename = path.basename(asset.assetPath, '.less');

      if (opts.main && basename !== path.basename(opts.main, '.less')) return null;

      asset.publishPath = path.join(path.dirname(asset.publishPath), `${basename}.css`);

      const source = await util.promisify(fs.readFile)(asset.assetPath, 'utf8');
      const output = await less.render(source, { ...opts, filename: asset.assetPath });

      await util.promisify(fs.writeFile)(asset.publishPath, output.css);

      return null;
    },
  };
}

function ejsPlugin() {
  const ejs = require('ejs');

  return {
    beforeBuild(document, template) {
      const data = { ...document.context, content: document.content };
      const options = { filename: document.templatePath };
      const content = ejs.render(template, data, options);

      return { ...document, content };
    }
  };
}

module.exports = {
  blocksPlugin,
  markedPlugin,
  lessPlugin,
  ejsPlugin,
};
