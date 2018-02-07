define("ace/mode/opendaydialogue", ["require","exports","module","ace/lib/oop","ace/mode/text","ace/mode/behavior","ace/mode/text_highlight_rules"], function(require, exports, module) {
    "use strict";
    
    var oop = require("../lib/oop");
    var TextMode = require("./text").Mode;
    var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;
    var Behaviour = require("./behaviour").Behaviour;
    
    var OpenDayDialogueHighlightRules = function() {
        var keywords = (
            "if|else|namespace|definitions|scene|choice"
        );
        var builtinConstants = (
            "true|false|undefined"
        );
    
        this.$rules = {
            start: [ 
                {
                    token: "comment",
                    regex: "\/\/.*$"
                },
                {
                    token: "string",
                    regex: "\\\"(\\\\.|[^\"\\\\])*\\\""
                }, 
                {
                    token: "number",
                    regex: "[0-9]+(\.[0-9][0-9]?)?"
                }, 
                {
                    token: "variable",
                    regex: "\\$[A-z_][A-z0-9_.]*\\b"
                },
                {
                    token: "command",
                    regex: "^\\s*(?!" + keywords + ")[A-z_.](?:[\\w\\d\\s\"._])*" // Also matches definition keys, which is okay
                },
                {
                    token: "operator",
                    regex: "\\+|\\-|\\*|\\/|%|<|>|<=|=>|==|!=|="
                },
                {
                    token: this.createKeywordMapper({
                                "constant.language": builtinConstants,
                                "keyword": keywords
                            }, "identifier"),
                    regex: "[A-z_.][A-z0-9_.]*\\b"
                },
                {
                    defaultToken: "text"
                }
            ]
        };
    };
    
    var Mode = function() {
        this.HighlightRules = OpenDayDialogueHighlightRules;
        this.$behaviour = new Behaviour();
    };
    
    oop.inherits(OpenDayDialogueHighlightRules, TextHighlightRules);
    oop.inherits(Mode, TextMode);

    (function() {
        this.type = "text";
        this.$id = "ace/mode/opendaydialogue";
    }).call(Mode.prototype);

    exports.Mode = Mode;
    
    exports.OpenDayDialogueHighlightRules = OpenDayDialogueHighlightRules;
});