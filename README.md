statiq
======

A node.js static website generator

* [Install](#install)
* [Basic usage](#basic-usage)
  * [Content](#content)
  * [Templates](#templates)
  * [Building](#building)
* [Advanced](#advanced)
  * [Directory context](#directory-context)
  * [Global context](#global-context)
  * [Directory indexes](#directory-indexes)
* [Command line tool](#command-line-tool)
* [Programmatic API](#programmatic-api)
* [Plugins](#plugins)
  * [Plugins API](#plugins-api)
  * [Included plugins](#included-plugins)

## Install

    $ npm install -g statiq

## Basic usage:

Create a statiq website with the interactive cli tool:

    $ statiq init

![statiqinit](https://user-images.githubusercontent.com/778104/69487186-67c0d380-0e34-11ea-80d9-e13607c7b056.gif)

This will bootstrap the folder structure, `statiqfile.js` and `package.json` in the current directory.
There are four directories: `content`, `templates`, `assets` and `publish`. By default, files in the `assets` folder will be copied as-is to the `publish` folder. Documents in the `content` folder will be merged into their corresponding templates from the `templates` folder and saved to the `publish` folder (mirroring content folder structure). For example, this structure:

    content/index.md
    content/about.md
    content/docs/index.md

Will result in:

    publish/index.html
    publish/about.html
    publish/docs/index.html

### Content

By default, content is placed in `.html` files. If you added the `markedPlugin`, content is placed in markdown `.md` documents.

Sample index.md:

    Welcome!
    =======
    
    This is a *test page*.

#### File variables

You can set *context variables* in each file, by placing a yaml/json object in its first lines, followed by a triple dash (`---`):

    title: Index page
    ---
    
    Welcome!
    ========
    ...

### Templates

Default templating engine is ejs. An index.html template file could look like this:

    <!doctype html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title><%- title %></title>
    </head>
    <body>
        <div id="main">
            <%- content %>
        </div>
    </body>
    </html>

Context variables are available, and the special `content` variable contains the document itself.

### Building

Finally, run:

    $ statiq

And you're ready to go!

## Advanced

### Directory context

If files in a same folder share some metadata, you can put it in context files within the folder. For example, add a `context.json` or `context.yaml` file in a `content/docs/` folder, like this:

    subtitle: My documents
    somedata: ...

Now, every document under `content/docs/` (including sub-directories) will have those variables set at build time, unless they are overwritten by a deeper level context or in-file context.

### Global context

Use the `context` property in the configuration object within the `statiqfile.js`:

    statiq.config({
      ...
      context: {
        sitename: "My awesome website",
        ...
      }
    })

This works just like putting a context file in the `content/` root. However, by using the statiqfile, you may perform any data processing/manipulation and pass the result, or even pass functions (like moment.js, sorting methods, etc).

### Directory indexes

In templates, you can iterate through files in a given folder using the special `index[folder]` variables.
Given this structure:

    content/index.md
    content/articles/myarticle.md
    content/articles/myarticle2.md
    content/articles/myarticle3.md
    content/articles/subarticles/subarticle.md
    content/articles/subarticles/subarticle2.md

You can list the articles folder in your templates accesing `index['articles']`, and the subarticles folder with `index['articles/subarticles']`.

    <h4>Articles:</h4>
    <ul>
    <% index['articles'].forEach(function(article){ %>
        <li><a href="<%= article.path %>"><%= article.title %></a></li>
    <% }) %>
    </ul>

Each `index[folder]` item is set to the context of that file plus a special `path` variable containing the relative path from the current file and a `current` variable which is `true` when the item is the same file accessing it.

#### Hidden documents

Files prefixed with `_` will be processed but they won't be included in the index.

## Command line tool

    $ statiq
Look for nearest statiqfile.js and build website

    $ statiq init
Create a new statiqfile and default folder structure

    $ statiq init -s
Create a new statiqfile only

    $ statiq add <filename>
Create a new website document/page/post

    $ statiq add <filename> --<key>=<value> --<key>=<value>...
Create a new document and set local context values

    $ statiq serve
Start a local server

    $ statiq watch
Start a file watcher and rebuild website when changes occur

    $ statiq serve -w
Start server and watcher

    $ statiq help
Show help

## Programmatic API

    const statiq = require('statiq');
    const site = statiq();

    site.config({
      ...
    });
    
    site.run();

### Methods

#### site.config(object config)

Sets site configuration just like a statiqfile. Default configuration is:

    {
      contentPath: 'content',
      templatesPath: 'templates',
      publishPath: 'publish',
      assetsPath: 'assets',
      defaultTemplate: 'index.html',
      contentExtension: '.md',
      publishExtension: '.html',
      hiddenRegex: /^_/, // filenames that shouldn't be included in indexes
      plugins: [],
      context: {}, // global context
      cwd: process.cwd(), // if site is built using the cli tool, it's set to the statiqfile.js dir by default
    }

Returns the config object.

#### site.use(fn plugin)

Adds a statiq plugin.
Returns void.

#### site.create(string file, object context, string content?)

Creates a document `file` with local `context` and `content`.
Returns a promise containing the document object.

Hooks: beforeCreate, afterCreate

#### site.read(string file)

Reads and cache a file in the content folder.
Returns a promise containing the document object.

Hooks: beforeRead, afterRead

#### site.update(string file, object context, string content)

Updates the `context` and `content` of a cached document `file`.
Returns a promise containing the document object.

Hooks: beforeUpdate, afterUpdate

#### site.build(string file)

Builds the cached document `file`. It'll use other cached documents and contexts to generate indexes.
Returns a promise containing the built document object.

Hooks: beforeBuild, afterBuild

#### site.buildAll()

Convenience method to build all the cached documents.

#### site.write(string file)

Writes the cached built document `file` to the filesystem.
Returns a promise containing the file path.

Hooks: beforeWrite, afterWrite

#### site.writeAll()

Convenience method to write all the cached built documents.

#### site.delete(string file)

Deletes the document `file` from the cache and the filesystem.
Returns a promise containing void.

#### site.scan(string path?)

Deep-scans the content directory and reads its documents. Specify a `path` if you don't want to start from the content root.
Returns a promise containing an array of read documents.

#### site.handleAssets()

Process the assets folder. By default, it'll just copy all files to the publish folder.

Hooks: beforeAsset, afterAsset

#### site.list()

Returns all the cached documents

#### site.run()

Convenience method to run scan(), buildAll() and writeAll().
Returns a promise containing an array of generated paths.

## Plugins

Plugins can be loaded using the `plugins` array in the site configuration:

    statiq.config({
        context: { ... }
        plugins: [myPlugin(), ejsPlugin(), markedPlugin()]
    });

Or alternatively, loaded later using `.use()`:

    statiq.use(myPlugin());

A statiq plugin consists of a function that returns an object with a set of hook properties that will exec in a given step of the build process.

    function myPlugin(options) {
        return {
            beforeBuild(document) {
                document.title = "Foo";
                return document;
            },
        }
    }

These hooks are executed in the same order the plugins were loaded.
When an `before*` hook returns a falsy value, it prevents its `after*` execution and also any other `before*` in the chain.

### Plugins API

#### beforeCreate(object document)
Runs before a new document is written into the file system.
The document object contains contentPath, context, content and source.
Must return the document object (modified or not), a new document object, or falsy to cancel the document creation.

#### afterCreate(object document)
Runs after a new document has been written to the file system, and can be used to perform any side effects. Returns void.

#### beforeRead(object document)
Runs before a content file is read and cached.
The document object contains contentPath, publishPath, and context (including global context).
Must return the document object (modified or not), a new document object, or falsy to skip reading the document.

#### afterRead(object document)
Runs after a document has been read and cached, and can be used to perform any side effects. Returns void.

#### beforeUpdate(object document, object newContext, string newContent)
Runs before an update is made to a cached document.
To access the current context or content of the document, you can use `document.context` and `document.content`.
Must return the document object (modified or not), a new document object, or falsy to skip updating the document.

#### afterUpdate(object document)
Runs after a document has been updated in cache, and can be used to perform any side effects. Returns void.

#### beforeBuild(object document, string template)
Runs before a document is built in memory. 
Must return the document object (modified or not), a new document object, or falsy to skip building the document.

#### afterBuild(object document)
Runs after a document has been built in cache, and can be used to perform any side effects. Returns void.

#### beforeWrite(object document)
Runs before a cached document is written to the file system.
Must return the document object (modified or not), a new document object, or falsy to skip writting the file.

#### afterWrite(object document)
Runs after a file has been written to the file system, and can be used to perform any side effects. Returns void.

#### beforeAsset(object assetDocument)
Runs when an asset file is found in the assets directory. `assetDocument` is an object containing `assetPath` and `publishPath`.
Must return the asset object (modified or not), a new object or falsy to skip processing this asset.

#### afterAsset(object assetDocument)
Runs after an asset has been processed, and can be used to perform any side effects.
Returns void.

### Included plugins

These plugins are shipped with statiq and can be imported from `statiq/plugins`.

#### markedPlugin

Lets you write documents content in markdown. Requires `marked`.

##### Usage

    const { markedPlugin } = require('statiq/plugins');

    statiq.use(markedPlugin(options))

###### Options

`parseMultilineContext` (boolean) Process context variables containing a multiline string. Defaults to `true`.

#### ejsPlugin

Lets you write templates using ejs. Requires `ejs`.

##### Usage

    const { ejsPlugin } = require('statiq/plugins');

    statiq.use(ejsPlugin())

#### lessPlugin

Converts `.less` files in the assets folder into `.css` files at build time. Requires `less`.

##### Usage

    const { lessPlugin } = require('statiq/plugins');

    statiq.use(lessPlugin(options))

###### Options

`main` (string) Optional. Copy only this filename to the publish folder.

The options object is passed as options to less' render method.

#### blocksPlugin

Lets you define content blocks in documents. Consider a multicolumn layout like this:

    <!doctype html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title><%= title %></title>
    </head>
    <body>
        <div class="left-column">
            <%- left %>
        </div>
        <div class="main">
            <%- content %>
        </div>
        <div class="right-column">
            <%- right %>
        </div>
    </body>
    </html>

Instead of using the `content` variable, you can define block sections just like this:

    title: Multi column
    ---
    
    <<left
    Welcome!
    ========
    
    Lorem ipsum dolor sit amet blah blah.
    left;
    
    <<right
    ### Useful links
    [Google](http://www.google.com/)
    [Wikipedia](http://www.wikipedia.org/)
    right;

    This is the main content.

These are [Heredoc](http://en.wikipedia.org/wiki/Here_document)-ish declaration.
Blocks start with `<<BLOCK_NAME` and end with `BLOCK_NAME;` (both in their own lines).
Block names are case-sensitive alphanumeric strings. Their content is removed from the `content` variable.
