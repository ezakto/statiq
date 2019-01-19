statiq
======

A node.js static website generator

Statiq reads a folder structure of source files and generates web-ready files.

### Install:

    npm install -g statiq

### Basic usage:

Create a statiq website with the cli tool:

    $ statiq init

This will create a folder structure. Then run `$ npm install` to install default dependencies (`ejs` for templates and `marked` for markdown content) and you're ready to go.
Source documents go to the content folder and templates in the templates folder. The resulting website will go to the publish folder. The assets folder is copied into the publish folder as is. Build your website structure in the content folder, with markdown-formatted pages. For example:

    content/index.md
    content/about.md
    content/docs/index.md

Sample index.md:

    Welcome!
    =======
    
    This is a *test page*.

Then make an index.html file in your templates folder.

    <!doctype html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Test Page</title>
    </head>
    <body>
        <div id="main">
            <%- content %>
        </div>
    </body>
    </html>

The `content` variable contains the parsed html.
Finally, run:

    $ statiq

You'll get all the parsed pages in your publish folder:

    publish/index.html
    publish/about.html
    publish/docs/index.html

### Local variables

You can set context variables for each source file, by placing a yaml/json object in its first lines:

    title: Index page
    ---
    
    Welcome!
    ========
    ...

*Notice the required triple dash (`---`)*

Then your template could look like:

    <!doctype html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title><%= title %></title>
    </head>
    <body>
    ...

### Blocks

Consider a multicolumn layout like this:

    <!doctype html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title><%= title %></title>
    </head>
    <body>
        <div id="main">
            <div class="left-column">
                <%- left %>
            </div>
            <div class="right-column">
                <%- right %>
            </div>
        </div>
        <div id="footer">Copyright &copy; <%= year %></div>
    </body>
    </html>

Instead of using the `content` variable, you can define block sections just like this:

    title: Multi column
    year: 2013
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

This is a [Heredoc](http://en.wikipedia.org/wiki/Here_document)-ish declaration.
By default, blocks start in a newline, with `<<BLOCK_NAME` and another newline.
Then, you close the block with `BLOCK_NAME;`.
Block names are case-sensitive alphanumeric strings.

### Directory context

If files in a same folder share some metadata, you can put it in context files within the folder. For example, add a `context.json` or `context.yaml` file in the `content/docs/` folder, like this:

    subtitle: My documents
    somedata: ...

Now, all your files under `content/docs/` (including sub-directories) will share those variables (unless they are overwritten by a deeper level context or in-file context).

### Global context

Use the `context` property in the configuration object within the `statiqfile.js`:

    statiq.config({
      ...
      context: {
        sitename: "My awesome website",
        ...
      }
    })

This works just like putting a `context.yaml` file in `content/`. However, by using the statiqfile, you may pass functions aswell (like moment.js, sorting methods, etc).

### Directory indexes

You can iterate files in a given folder with the special `index[folder]` variables.
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

Each `index[folder]` item is set to the context of that file plus `path` (that points to the item file relatively from the current file) and `current` (which is true when the item is the same file accessing it). This is great for navigable indexes.

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
    
    statiq
      .config({
        ...
      })
      .run();

### Methods

#### statiq.config(object config)

Sets site configuration just like a statiqfile. Default configuration is:

    {
      paths: {
        content: 'content',
        templates: 'templates',
        publish: 'publish',
        assets: 'assets',
      },
      defaultTemplate: 'index.html',
      contentExtension: '.md',
      publishExtension: '.html',
      hiddenRegex: /^_/, // filenames that shouldn't be included in indexes
      contentParser: identity, // returns content as is
      templateParser: simpleParser, // replaces {{key}} with value
      contextHandler: identity, // doesn't transform contexts
      indexHandler: identity, // doesn't transform indexes
      assetHandler: syncCopy, // just copy assets
      context: {}, // global context
      cwd: null, // it's statiqfile.js dir, should be set when using the programmatic api
    }

Returns statiq.

#### statiq.use(fn plugin)

Adds a statiq plugin.
Returns void.

#### statiq.create(string file, object context, string content?)

Creates a document `file` with local `context` and `content`.
Returns a promise that resolves to the absolute path to the file.

#### statiq.read(string file)

Reads a file path and builds a document object.
Returns a promise that resolves to:

    {
      documentPath,
      sourcePath,
      publishPath,
      templatePath,
      rawContext,
      rawContent,
      context,
      content,
    }

#### statiq.update(string file, object context, string content)

Updates the `context` and `content` of an existing `file`.
Returns a promise that resolves to the absolute path to the file.

#### statiq.delete(string file)

Deletes an existing `file`.
Returns a promise that resolves to void.

#### statiq.loadContext(string dir)

Tries to load and parse a context file in the given directory.
Returns a promise that resolves to a context object or undefined if not found.

#### statiq.scan(string dir?)

Deep-scans a directory, reads its documents and caches the resulting document objects. If no directory is provided, it'll scan the default content directory.
Returns a promise that resolves to the cached documents in the form `{ [file]: [document object]... }`.

#### statiq.clear()

Clears the cached documents and contexts.

#### statiq.build(string file)

Builds a single file. It'll use cached documents and contexts to generate indexes.
Returns a promise that resolves to the absolute path to the generated file.

#### statiq.buildAll()

Builds all files in cache.
Returns a promise that resolves to an array of absolute paths to the generated files.

#### statiq.copyAsset(string file)

Copies a file from the assets folder to the publish folder.
Returns a promise that resolves to the absolute path to the new file.

#### statiq.copy(string dir?)

Deep copies the file contents of the given directory to the publish folder. If no directory is provided, it'll scan the default assets directory.
Returns a promise that resolves to void.

#### run

Convenience method that clears cache, copies all assets, scans all documents and build them.
Returns a promise that resolves to an array of absolute paths to the generated files.
