/*jslint node: true*/
"use strict";

var request = require("request");
var cheerio = require("cheerio");
var events = require("events").EventEmitter;
var util = require("util");
var urlMod = require("url");
var Q = require("q");
var fs = require("fs");
var pathMod = require("path");

function Scraper(options) {
    this.options = {
        url: null,
        save: false,
        path: null
    };
    if (options !== undefined) {
        for(var attrname in options) {
            this.options[attrname] = options[attrname];
        }
    }
    events.call(this);
}

util.inherits(Scraper, events);

Scraper.prototype.scrape = function () {
    var ref = this;
    
    var result = null;
    var url = this.options.url;
    
    if (url !== undefined && url !== null) {
        request(url, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                result = [];
                
                var $ = cheerio.load(body);
                
                // var globalPromise = [];
                
                var filePathRegex = new RegExp("^(\\/[a-zA-Z0-9\\-_]+\\.(jpg|gif|png))+$/i");
                
                $("img").each(function () {
                    result.push($(this).attr("src"));
                });
                
                $("a").has("img").each(function () {
                    var link = $(this).attr("href");
                    if (link !== undefined) {
                        var linkParsed = urlMod.parse(link);
                        if (filePathRegex.test(linkParsed.pathname)) {
                            result.push(link);
                        }
                    }
                    
                    /*var localPromise = Q.defer();
                    globalPromise.push(localPromise);
                    var link = $(this).attr("href");
                    request(link, function() {
                        localPromise.resolve();
                    });*/
                });
                
                /*Q.all(globalPromise)
                .then(function (results) {
                   console.log("1234124123");
                });*/
            }
            
            if (ref.options.save === true) {
                ref.save(result);
            } else {
                ref.emit("end", result);
            }
        });
    }
};

Scraper.prototype.save = function (images) {
    if (this.options.path === undefined || this.options.path === null) {
        this.options.path = pathMod.dirname(require.main.filename) + "/";
    }
    var ref = this;
    
    if (images !== undefined) {
        var globalPromises = [];
        
        for(var i = 0; i < images.length; i++) {
            var localPromise = Q.defer();
            globalPromises.push(localPromise);
            request(images[i], function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    var file = ref.options.path + pathMod.basename(this.uri.href);
                    var imageFile = fs.createWriteStream(pathMod.normalize(file));
                    imageFile.on("error", function (e) {
                        console.error(e);
                    });
                    imageFile.write(body);
                    localPromise.resolve();
                }
            });
        }
        
        Q.all(globalPromises)
        .then(function (results) {
            ref.emit("end", images);
        });
    }
};

module.exports = Scraper;