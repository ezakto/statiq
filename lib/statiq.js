
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

statiq.config = _.clone(statiq.defaults);

// Sets configuration stuff and normalize (I guess) stuff
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
    if (!fs.existsSync(statiq.config.inputRoot) || !fs.statSync (statiq.config.inputRoot).isDirectory() ||
        !(fs.existsSync(statiq.config.outputRoot) && !fs.statSync(statiq.config.outputRoot).isDirectory())) {
        console.error('Invalid input/output roots');
        process.exit();
    }
    
    mu.root = statiq.config.templatesRoot;
    
    return statiq;
}

// Returns a single array containing all the files in @dir ending with @ext
statiq.listSources = function(dir, ext) {
    if (!ext) ext = statiq.config.inputExt;
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

// Given a file, Returns the path of its distribution file
statiq.counterPart = function(file) {
    // Calculate output filename by moving to output folder and replacing extensions
    file = path.join(statiq.config.outputRoot, path.relative(statiq.config.inputRoot, file));
    file = path.join(path.dirname(file), path.basename(file, statiq.config.inputExt)+statiq.config.outputExt);
    return file;
}

// Parses all files in a directory
statiq.process = function(dir) {
    if (!dir) dir = statiq.config.inputRoot;
    statiq.preProcess(dir);
    
    _.each(statiq._index, function(files, directory) {
        _.each(files, function(file) {
            var locals = {};
            
            if (!file.locals.template && !(file.locals.template = statiq.config.defaultTemplate)) {
                return;
            }
            
            file.locals.template = path.join(statiq.config.templatesRoot, file.locals.template);
            
            _.extend(locals, statiq.config.globals, file.locals);
            
            // Binds "iteratible" indexes for each directory,
            // passing file locals as template context,
            // and relative (from current file) url to each file
            _.each(statiq._index, function(files, directory) {
                if (directory == '.') directory = 'root';
                directory.split(path.sep).join('/'); // Normalizes variable names to use only /
                locals['list_'+directory] = _.map(files, function(f) {
                    return _.extend({}, f.locals, { url: path.relative(path.dirname(file.url), f.url) });
                });
            });
            
            // Full file parse
            locals.document = marked(file.document.replace(statiq.config.srcSectionRegex, '$2'));
            
            // Section variables
            var sections = {};
            _.each(file.document.match(statiq.config.srcSectionRegex), function(section) {
                sections[section.replace(statiq.config.srcSectionRegex, '$1')] = marked(section.replace(statiq.config.srcSectionRegex, '$2'));
            });
            _.extend(locals, sections);
            
            // Build folder structure
            mkdirp.sync(path.dirname(file.url));
            
            // Parse template and save file
            var compiled = '';
            mu.compileAndRender(locals.template || statiq.config.defaultTemplate, locals)
                .on('data', function(data) {
                    compiled += data.toString();
                })
                .on('end', function() {
                    fs.writeFile(file.url, compiled, function() {
                        console.log('File: '+file.url+' processed.');
                    });
                });
        });
    });
    
    return statiq;
}

// Returns a hash with file url, local variables and document content
statiq.preProcessFile = function(file) {
    var url, document, locals = {};
    
    url = statiq.counterPart(file);
    document = fs.readFileSync(file, { encoding: 'utf8' });
    
    // Find for locals header
    if (statiq.config.srcHeadRegex.test(document)) {
        try {
            _.extend(locals, statiq.config.srcHeadParse(document.match(statiq.config.srcHeadRegex)[1]));
            document = document.replace(statiq.config.srcHeadRegex, '');
        } catch(e) {
            console.error("Bad locals header syntax on "+file);
        }
    }
    
    return {
        url: url,
        locals: locals,
        document: document
    };
}

// Builds indexes
statiq.preProcess = function(dir) {
    var files = statiq.listSources(dir);
        
    statiq._index = {};
    _.each(files, function(file) {
        file = statiq.preProcessFile(file);
        var dirname = path.dirname(path.relative(statiq.config.outputRoot, file.url));
        if (!statiq._index[dirname]) {
            statiq._index[dirname] = [];
        }
        statiq._index[dirname].push(file);
    });
    
    return statiq;
}


