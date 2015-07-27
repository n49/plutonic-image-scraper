/*jslint node: true*/
"use strict";

var mkdirp = require("mkdirp");

var scraperUtils = {
    ensureDirectoryExists: function (path, callback) {
        mkdirp(path, function (err) {
            if (err) {
                if (err.code == "EEXIST") {
                    callback(null);
                } else {
                    callback(err);
                }
            } else {
                callback(null);
            }
        });
    }
};

module.exports = scraperUtils;
