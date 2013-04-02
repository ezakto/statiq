
var fs     = require('fs'),
    mkdirp = require('mkdirp'),
    marked = require('marked'),
    mu     = require('mu2'),
    path   = require('path'),
    _      = require('underscore');

var statiq = module.exports = {};

statiq.defaults = {
    // Base dir
    root: process.cwd(),
    
    // Paths and filenames
    inputRoot: "src/",
    outputRoot: "dst/",
    templatesRoot: "tpl/",
    defaultTemplate: "index.html",
    
    inputExt: ".md",
    outputExt: ".html",
    
    // Regexps
    // Locals header syntax and parser
    srcHeadRegex: /^\s*(\{[\s\S]*?\});\s*\n/,
    srcHeadParse: JSON.parse,
    // Section variables declared with heredocument-like syntax
    srcSectionRegex: /^<<([a-zA-Z0-9]+)\s*\n([\s\S]*?)\n\1;\s*$/gm
};

statiq.load = statiq.set = function(config) {
    statiq.config = _.extend(_.clone(statiq.defaults), config);
    
    // Absolutize paths if needed
    if (statiq.config.inputRoot.substring(0, 1) != '/') {
        statiq.config.inputRoot = path.join(statiq.config.root, statiq.config.inputRoot);
    }

    if (statiq.config.outputRoot.substring(0, 1) != '/') {
        statiq.config.outputRoot = path.join(statiq.config.root, statiq.config.outputRoot);
    }

    if (statiq.config.templatesRoot.substring(0, 1) != '/') {
        statiq.config.templatesRoot = path.join(statiq.config.root, statiq.config.templatesRoot);
    }

    // Check for required directories
    if (!fs.existsSync(statiq.config.inputRoot)  ||
        !fs.existsSync(statiq.config.outputRoot) ||
        !fs.statSync(statiq.config.inputRoot) .isDirectory() ||
        !fs.statSync(statiq.config.outputRoot).isDirectory()) {
        console.error('Invalid input/output roots');
        process.exit();
    }
    
    mu.root = config.templatesRoot;
    
    return statiq;
}

// Returns an array with all the files under @dir with the extension @ext
statiq.listSources = function(dir, ext) {
    if (!ext) ext = '.md';
    var list = [];
    dir = path.normalize(dir);
    _.each(fs.readdirSync(dir), function(child) {
        child = path.join(dir, child);
        var file = fs.statSync(child);
        
        if (file.isDirectory()) {
            list = _.union(list, statiq.listSources(child, ext));
        } else if (path.extname(child) == ext) {
            list.push(child);
        }
    });
    
    return list;
};

// Parse a file and creates it's distribution counterpart
statiq.processFile = function(file) {
    var dest, contents, locals = _.extend({}, statiq.config.globals),
    
    // Calculate output filename by moving to output folder and replacing extensions
    dest = path.join(statiq.config.outputRoot, path.relative(statiq.config.inputRoot, file));
    dest = path.join(path.dirname(dest), path.basename(dest, statiq.config.inputExt)+statiq.config.outputExt);
    
    contents = fs.readFileSync(file, { encoding: 'utf8' });
    
    // Find for locals header
    if (statiq.config.srcHeadRegex.test(contents)) {
        try {
            _.extend(locals, statiq.config.srcHeadParse(contents.match(statiq.config.srcHeadRegex)[1]));
            contents = contents.replace(statiq.config.srcHeadRegex, '');
        } catch(e) {
            console.error("Bad locals header syntax on "+file);
        }
    }
    
    if (!locals.template && !statiq.config.defaultTemplate) {
        return;
    }
    
    // Full file parse
    locals.document = marked(contents.replace(statiq.config.srcSectionRegex, '$2'));
    
    // Section variables
    var sections = {};
    _.each(contents.match(statiq.config.srcSectionRegex), function(section) {
        sections[section.replace(statiq.config.srcSectionRegex, '$1')] = marked(section.replace(statiq.config.srcSectionRegex, '$2'));
    });
    _.extend(locals, sections);
    
    mkdirp.sync(path.dirname(dest));
    
    var compiled = '';
    mu.compileAndRender(locals.template || statiq.config.defaultTemplate, locals)
        .on('data', function(data) {
            compiled += data.toString();
        })
        .on('end', function() {
            fs.writeFile(dest, compiled, function() {
                console.log('File: '+dest+' processed.');
            });
        });
}

// Parses all the files in input directory
statiq.process = function() {
    var files = statiq.listSources(statiq.config.inputRoot, statiq.config.inputExt);
    _.each(files, function(file) {
        statiq.processFile(file);
    });
}

// http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
RegExp.escape = function(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

