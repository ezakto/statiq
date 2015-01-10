var _ = require('lodash'),
    fs = require('fs'),
    path = require('path'),
    mkdirp = require('mkdirp'),
    marked = require('marked'),
    mustache = require('mu2');

var defaults = {
    "defaultTemplate": "index.html",
    "tplPath": "tpl",
    "srcPath": "src",
    "dstPath": "dst",
    "srcExt": ".md",
    "dstExt": ".html",
    "cwd": false,
    "localsRegex": /^(\{[\s\S]*\});/,
    "sectionsRegex": /^<<([a-z0-9]+)\n([\s\S]+)\n\1;$/gm,
    "parser": marked,
    "parserOptions": {},
    "globals": {}
};

function Statiq(options) {
    var file, config = _.extend({}, defaults, options), srcFiles = [];

    config.cwd = config.cwd ? path.resolve(config.cwd) : process.cwd();

    var tplPath = path.join(config.cwd, config.tplPath);
    var srcPath = path.join(config.cwd, config.srcPath);
    var dstPath = path.join(config.cwd, config.dstPath);

    mustache.root = tplPath;
    marked.setOptions(config.parserOptions);

    (function readdir(dir) {
        var stat = fs.statSync(dir);
        if (stat.isDirectory()) {
            fs.readdirSync(dir).forEach(function(elem){
                readdir(path.join(dir, elem));
            });
        } else if (stat.isFile() && dir.substr(-3, 3) === config.srcExt) {
            var src = fs.readFileSync(dir, { encoding: 'utf8' });
            var document, locals, sections = {};

            try {
                locals = JSON.parse(src.match(config.localsRegex)[1]);
                src = src.replace(config.localsRegex, '').replace(/^\s+|\s+$/g, '');
            } catch (e) {
                locals = {};
            }

            document = src.replace(config.sectionsRegex, function(match, id, content){
                sections[id] = marked(content);
                return content;
            });

            srcFiles.push({
                srcFile: path.relative(srcPath, dir),
                dstFile: path.relative(srcPath, dir).replace(new RegExp(config.srcExt + '$'), (locals.dstExt || config.dstExt)), 
                src: src,
                locals: locals,
                sections: sections,
                document: marked(document)
            });
        }
    })(srcPath);

    srcFiles.forEach(function(file){
        var hash = _.extend({ document: file.document }, config.globals, file.locals, file.sections),
            result = '',
            targetDir = path.dirname(file.dstFile);

        hash.root = path.relative(path.join(dstPath, targetDir), dstPath) || '.';

        srcFiles.forEach(function(f){
            var dir = path.dirname(f.dstFile);
            !hash['list_'+dir] && (hash['list_'+dir] = []);
            hash['list_'+dir].push(_.extend({}, f.locals, {
                path: path.relative(targetDir, f.dstFile)
            }));
        });
            
        mustache.compileAndRender(path.join(tplPath, hash.template || config.defaultTemplate), hash)
            .on('data', function (data) {
                result += data.toString();
            })
            .on('end', function(){
                mkdirp(path.join(dstPath, targetDir), function(err, made){
                    !err && fs.writeFile(path.join(dstPath, file.dstFile), result, function(err){
                        !err && console.log('\u2713 ' + file.dstFile);
                    });
                });
            });
    });
};

module.exports = Statiq;