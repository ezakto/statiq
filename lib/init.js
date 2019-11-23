const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');
const colors = require('ansi-colors');
const mkdirp = require('mkdirp-promise');
const { execSync } = require('child_process');
const { promisify } = require('util');

const writeFile = promisify(fs.writeFile);
const { log } = console;

const defaults = {
  contentPath: 'content',
  templatesPath: 'templates',
  publishPath: 'publish',
  assetsPath: 'assets',
};

function stringify(value) {
  if (value === 'true' || value === 'false') return Boolean(value);
  if (/^(\d*\.)?\d+$/.test(value)) return Number(value);

  return JSON.stringify(value, null, 2);
}

function buildStatiqfile(options) {
  let defaultsnl = false;
  let statiqfile = 'const {\n  blocksPlugin,\n';

  if (options.plugins.length) {
    options.plugins.forEach(plugin => {
      statiqfile += `  ${plugin}Plugin,\n`;
    });
  }

  statiqfile += '} = require(\'statiq/plugins\');\n';
  statiqfile += '\n';
  statiqfile += 'module.exports = function(statiq) {\n';
  statiqfile += '  statiq.config({\n';

  Object.entries(defaults).forEach(([key, value]) => {
    if (options[key] !== value) {
      statiqfile += `    ${key}: '${options[key]}',\n`;
      defaultsnl = true;
    }
  });

  if (defaultsnl) {
    statiqfile += '\n';
  }

  if (options.context) {
    statiqfile += '    context: {\n';

    Object.entries(options.context).forEach(([key, value]) => {
      statiqfile += `      ${key}: ${stringify(value)},\n`;
    });

    statiqfile += '    },\n';
    statiqfile += '\n';
  }

  if (options.plugins.includes('marked')) {
    statiqfile += '    contentExtension: \'.md\',\n';
    statiqfile += '\n';
  }

  statiqfile += '    plugins: [\n';
  statiqfile += '      blocksPlugin(),\n';

  if (options.plugins.length) {
    options.plugins.forEach(plugin => {
      statiqfile += `      ${plugin}Plugin(),\n`;
    });
  }

  statiqfile += '    ],\n';
  statiqfile += '  });\n';
  statiqfile += '};\n';

  return statiqfile;
}

function buildPackage(options) {
  const pkg = {
    name: 'statiqsite',
    version: '1.0.0',
    main: 'index.js',
    dependencies: {},
  };

  if (options.plugins.includes('ejs')) pkg.dependencies.ejs = '^2.6.1';
  if (options.plugins.includes('less')) pkg.dependencies.less = '^3.9.0';
  if (options.plugins.includes('marked')) pkg.dependencies.marked = '^0.7.0';

  return JSON.stringify(pkg, null, 2);
}

async function createDirectories(options) {
  await mkdirp(path.join(process.cwd(), options.contentPath));
  log(`${colors.cyan('\u2713')} created ${options.contentPath}/`);

  await mkdirp(path.join(process.cwd(), options.templatesPath));
  log(`${colors.cyan('\u2713')} created ${options.templatesPath}/`);

  await mkdirp(path.join(process.cwd(), options.publishPath));
  log(`${colors.cyan('\u2713')} created ${options.publishPath}/`);

  await mkdirp(path.join(process.cwd(), options.assetsPath));
  log(`${colors.cyan('\u2713')} created ${options.assetsPath}/`);
}

async function createFiles(statiqfile, pkg) {
  await writeFile(path.join(process.cwd(), 'statiqfile.js'), statiqfile);
  log(`${colors.cyan('\u2713')} created statiqfile.js`);

  await writeFile(path.join(process.cwd(), 'package.json'), pkg);
  log(`${colors.cyan('\u2713')} created package.json`);
}

module.exports = async function init() {
  log(`You're about to initialize a statiq website in ${colors.bold(process.cwd())}`);

  const isNotEmpty = fs.readdirSync(process.cwd()).length;

  if (isNotEmpty) {
    log(colors.red('! The directory is not empty!'));
  }

  const options = await inquirer.prompt([
    {
      type: 'input',
      name: 'contentPath',
      message: 'Enter the content directory name',
      default: defaults.contentPath,
    },
    {
      type: 'input',
      name: 'templatesPath',
      message: 'Enter the templates directory name',
      default: defaults.templatesPath,
    },
    {
      type: 'input',
      name: 'assetsPath',
      message: 'Enter the assets directory name',
      default: defaults.assetsPath,
    },
    {
      type: 'input',
      name: 'publishPath',
      message: 'Enter the publish directory name',
      default: defaults.publishPath,
    },
    {
      type: 'checkbox',
      name: 'plugins',
      message: 'Which default plugins do you want to include?',
      choices: [
        { name: ' Markdown (marked)', value: 'marked' },
        { name: ' Less', value: 'less' },
        { name: ' EJS', value: 'ejs' },
      ],
    },
    {
      type: 'confirm',
      name: 'context',
      message: 'Do you want to add some global context variables now?',
      default: false,
    },
  ]);

  if (options.context) {
    let ask = true;
    options.context = {};

    while (ask) {
      // eslint-disable-next-line no-await-in-loop
      const variable = await inquirer.prompt([
        {
          type: 'input',
          name: 'key',
          message: 'Enter the variable name',
        },
        {
          type: 'input',
          name: 'value',
          message: 'Enter the value',
        },
        {
          type: 'confirm',
          name: 'again',
          message: 'Do you want to add another variable?',
          default: true,
        },
      ]);

      options.context[variable.key] = variable.value;

      ask = variable.again;
    }
  }

  const statiqfile = buildStatiqfile(options);
  const pkg = buildPackage(options);

  await createDirectories(options);
  await createFiles(statiqfile, pkg);

  if (options.plugins.length) {
    const install = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'now',
        message: `Do you want to run ${colors.cyan('npm install')} now?`,
        default: true,
      },
    ]);

    if (install.now) {
      execSync('npm install', { stdio: [0, 1, 2] });
    }
  }
};
