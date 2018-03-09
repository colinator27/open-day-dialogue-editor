define("ace/theme/opendaydialogue",["require","exports","module","ace/lib/dom"], function(require, exports, module) {

    exports.isDark = false;
    exports.cssClass = "ace-opendaydialogue";
    exports.cssText = ".ace-opendaydialogue .ace_gutter {\
    background: #ebebeb;\
    color: #333;\
    overflow : hidden;\
    }\
    .ace-opendaydialogue {\
    background-color: #fff;\
    color: black;\
    }\
    .ace-opendaydialogue .ace_cursor {\
    color: black;\
    }\
    .ace-opendaydialogue .ace_fold {\
    }\
    .ace-opendaydialogue .ace_operator {\
    color: rgb(104, 118, 135);\
    }\
    .ace-opendaydialogue .ace_comment {\
    color: #236e24;\
    }\
    .ace-opendaydialogue .ace_constant {\
    color: rgb(0, 0, 205);\
    }\
    .ace-opendaydialogue .ace_number {\
    color: rgb(0, 0, 205);\
    }\
    .ace-opendaydialogue .ace_variable {\
    color: rgb(49, 132, 149);\
    }\
    .ace-opendaydialogue .ace_special {\
    color: rgb(111, 111, 111);\
    }\
    .ace-opendaydialogue .ace_command {\
    color: rgb(126, 0, 200);\
    }\
    .ace-opendaydialogue .ace_marker-layer .ace_selection {\
    background: rgb(181, 213, 255);\
    }\
    .ace-opendaydialogue .ace_marker-layer .ace_step {\
    background: rgb(252, 255, 0);\
    }\
    .ace-opendaydialogue .ace_marker-layer .ace_stack {\
    background: rgb(164, 229, 101);\
    }\
    .ace-opendaydialogue .ace_marker-layer .ace_active-line {\
    background: rgba(0, 0, 0, 0.07);\
    }\
    .ace-opendaydialogue .ace_gutter-active-line {\
    background-color : #dcdcdc;\
    }\
    .ace-opendaydialogue .ace_marker-layer .ace_selected-word {\
    background: rgb(250, 250, 255);\
    border: 1px solid rgb(200, 200, 250);\
    }\
    .ace-opendaydialogue .ace_keyword {\
    color: rgb(147, 15, 128);\
    }\
    .ace-opendaydialogue .ace_string {\
    color: #1A1AA6;\
    }\
    .ace-opendaydialogue .ace_indent-guide {\
    background: url(\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAE0lEQVQImWP4////f4bLly//BwAmVgd1/w11/gAAAABJRU5ErkJggg==\") right repeat-y;\
    }\
    .ace_editor, .ace_editor div {\
        font-family: \"Lucida Console\", Monaco, monospace;\
    }";
    
    var dom = require("../lib/dom");
    dom.importCssString(exports.cssText, exports.cssClass);
});