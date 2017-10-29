{ "title": "Multiple sections", "template": "multi.html" }
---

<<hero

This other page use heredocument sections.

This section will be closed as soon as `hero;` appears in a newline.

hero;

It also loads a custom template rather than defaultTemplate.

This is done by using the special `template` variable in the local variables hash.
