# Jamulus History Tool

This comprises two scripts:
* A PHP script to parse the Jamulus log file and emit it as a JSON response
* A JS script to parse the JSON response and emit an SVG DOM node

This replaces the History Graph that used to be part of the Jamulus server itself.

## Dependencies

* jQuery Timer by Matt Schmidt
  * https://github.com/sloat/timer/blob/8ecea1543327a7d09be35fcab677fe930ba4b684/jquery.timer.js
    jquery.timer.js is needed.  Put it in the same place as the other js files.  I used this old version
    but the new version is the same except it's "MIT License" rather than "BSD License" and actually includes
    a LICENSE.txt file!  "In truth, I don't really care what you do with it," says Matt...

## Configuration

### PHP
You will need to specify the server-side location of your Jamulus log.
This all works only if you are running the webserver (including the PHP) on a box that has access to the Jamulus log.
Right up at the top of the script, you'll find:
* `$jamulus_log = "/opt/Jamulus/log/Jamulus.log";`

Change as required.

The script is currently rather flexible (I'm trusting...) and allows the caller to specify the number
of days required and the max lines (or the number of lines plus a flag that can be used to have the lines from the start).
You may want to remove some of this.

### Javascript
`js/history_controller.js` is a jQuery controller that does two main things:
* find all the "interesting" bits of `index.html`
* runs the timed updates to the graph.

So if you want to change `index.html`, you will need to update the jQuery, too.

### Layout
You should have the `js` and `php` directories as subdirectories of the directory `index.html` lives in:
```
.../index.html
.../js/...
```
`index.html` pulls the js files in on that basis and `js/history_controller.js` calls the php script on that basis.
If you want to change things, you'll need to update both.
