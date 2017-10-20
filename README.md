statiq
======

A node.js static website generator

Statiq reads a folder structure of source files and generates a replicated structure with web-ready files.

### Install:

    npm install -g statiq

### Basic usage:

Create a `statiqfile.js` file with the cli tool:

    $ statiq init

You can edit the file contents, and then you can create the folders running:

    $ statiq init -d

And you're ready to go. Source documents go to the sources folder and templates in the templates folder. The generated website will go to the dist folder. Build your website structure in the sources folder, with markdown-formatted pages. For example:

    sources/index.md
    sources/about.md
    sources/docs/index.md

Sample index.md:

    Welcome!
    =======
    
    This is a *test page*.

Then make an index.html file in your templates folder. The default template engine is ejs, but it can be changed in the statiqfile.js.

    <!doctype html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Test Page</title>
    </head>
    <body>
        <div id="main">
            <%- document %>
        </div>
    </body>
    </html>

The `document` variable contains the parsed html.
Finally, run:

    $ statiq

You'll get all the parsed pages in your distribution folder:

    dist/index.html
    dist/about.html
    dist/docs/index.html

### Local variables

You can set local variables for each source file, by placing a yaml/json object in its first lines:

    title: Index page
    ---
    
    Welcome!
    ========
    ...


*Notice the required triple dash (`---`) at the end of the variables.*
Then your template could look like:

    <!doctype html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title><%= title %></title>
    </head>
    <body>
    ...

### Sections

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

Instead of using the `document` variable (which contains the entire page), you can define sections just like this:

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
Sections start in a newline, with `<<SECTION_NAME` and another newline.
Then, you close the section with `SECTION_NAME;`.
Section names are case-sensitive alphanumeric strings.

### Global variables

Use the "globals" property in the configuration object within the `statiqfile.js` object:

    statiq.config({
      ...
      globals: {
        sitename: "My awesome website",
        ...
      }
    })

Those variables will be available across the site:

    <!doctype html>
    <head>
       <title><%= title %> - <%= sitename %></title>
    </head>
    <body>
    ...

### Directory indexes

You can iterate files in a given folder with the special `index[folder]` variables.
Given this structure:

    sources/index.md
    sources/articles/myarticle.md
    sources/articles/myarticle2.md
    sources/articles/myarticle3.md
    sources/articles/subarticles/subarticle.md
    sources/articles/subarticles/subarticle2.md

You can list the articles folder in your templates with the `index['articles']` variable, and the subarticles folder with `index['articles/subarticles']`.

    <h4>Articles:</h4>
    <ul>
    <% index['articles'].forEach(function(article){ %>
        <li><a href="<%= article.path %>"><%= article.title %></a></li>
    <% }) %>
    </ul>

The context of the `index[folder]` variable items is set to the local hash of that file with the plus `path` variable that points to the item file relatively from the current file. This is great for navigable indexes.
Files prefixed with `_` won't be included in the index.
