statiq
======

A node.js static website generator

Statiq reads a folder structure of source files and generates web-ready files.

### Install:

    npm install -g statiq

You might want to install `ejs` (templates) and `marked` (markdown) in your project folder:

    npm install --save ejs marked

### Basic usage:

Create a `statiqfile.js` file with the cli tool:

    $ statiq init

You can edit the file contents, and then you can create the folders running:

    $ statiq init -d

And you're ready to go. Source documents go to the content folder and templates in the templates folder. The resulting website will go to the publish folder. Assets folder is copied into publish folder as is. Build your website structure in the content folder, with markdown-formatted pages. For example:

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

Now, all your files under `content/docs/` (including sub-directories) will share those variables (unless they are overwritten by a deeper level contexxt or in-file context).

### Global context

Use the `context` property in the configuration object within the `statiqfile.js`:

    statiq.config({
      ...
      context: {
        sitename: "My awesome website",
        ...
      }
    })

This works just like putting a `context.yaml` file in `content/`. However, using the statiqfile, you can pass functions aswell (like moment.js, sorting methods, etc).

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
