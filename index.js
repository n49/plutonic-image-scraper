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
var scraperUtils = require("./inc/scraperUtils");

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
    var result = {
        status: "ERROR"
    };
    var url = this.options.url;
    
    var ref = this;
    
    if (url !== undefined && url !== null) {
        request(url, function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var $ = cheerio.load(body);
                
                var images = [];
                var filePathRegex = new RegExp("^(\\/[a-zA-Z0-9\\-_]+\\.(jpg|gif|png))+$/i");
                
                var urlParsed = urlMod.parse(response.request.uri.href);
                var urlRoot = "";
                if (urlParsed.protocol) {
                    urlRoot += urlParsed.protocol;
                } else {
                    urlRoot += "http:";
                }
                urlRoot += "//";
                if (urlParsed.auth) {
                    urlRoot += urlParsed.auth + "@";
                }
                if (urlParsed.hostname) {
                    urlRoot += urlParsed.hostname;
                }
                if (urlParsed.port) {
                    urlRoot += ":" + urlParsed.port;
                }
                var urlRootWithPath = urlRoot + urlParsed.pathname.substring(0, urlParsed.pathname.lastIndexOf("/"));
                
                $("img").each(function () {
                    var src = $(this).attr("src");
                    var srcParsed = urlMod.parse(src);
                    if (!srcParsed.hostname) {
                        if (src.substring(0, 2) == "//") {
                            if (urlParsed.protocol) {
                                src = urlParsed.protocol + src;
                            } else {
                                src = "http:" + src;
                            }
                        } else if (src.substring(0, 1) == "/") {
                            src = urlRoot + src;
                        } else {
                            src = urlRootWithPath + "/" + src;
                        }
                    }
                    
                    images.push(src);
                });
                
                $("a").has("img").each(function () {
                    var link = $(this).attr("href");
                    if (link !== undefined) {
                        var linkParsed = urlMod.parse(link);
                        if (filePathRegex.test(linkParsed.pathname)) {
                            images.push(link);
                        }
                    }
                });
                
                if (ref.options.save === true) {
                    ref.save(images);
                } else {
                    result.status = "SUCCESS";
                    result.data = images;
                    ref.emit("endscrape", result);
                }
            } else {
                result.error = error.toString();
                ref.emit("endscrape", result);
            }
        });
    } else {
        result.error = "URL not defined";
        ref.emit("endscrape", result);
    }
};

Scraper.prototype.save = function (images) {
    var result = {
        status: "ERROR"
    };
    if (this.options.path === undefined || this.options.path === null) {
        // this.options.path = pathMod.dirname(require.main.filename) + "/";
        this.options.path = pathMod.dirname(require.main.filename) + "/images/plutonic-image-scraper/";
    }
    var ref = this;
    
    scraperUtils.ensureDirectoryExists(this.options.path, function (err) {
        if (!err) {
            if (images !== undefined && Array.isArray(images)) {
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
                            imageFile.write(body, function () {
                                localPromise.resolve();
                            });
                        }
                    });
                }
                
                Q.all(globalPromises)
                .then(function (results) {
                    result.status = "SUCCESS";
                    result.data = images;
                    ref.emit("endsave", result);
                });
            } else {
                result.error = "Images array missing";
                ref.emit("endsave", result);
            }
        } else {
            result.error = "Could not create directory";
            result.err = err;
            ref.emit("endsave", result);
        }
    });
};

module.exports = Scraper;