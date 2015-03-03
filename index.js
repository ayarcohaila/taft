#!/usr/bin/env node
'use strict';

var fs = require('fs'),
    path = require('path'),
    extend = require('extend'),
    Handlebars = require('handlebars'),
    HH = require('handlebars-helpers'),
    YFM = require('yfm');

module.exports = taft;

function taft(file, options, data) {
    var t = new Taft(options, data);
    return t.eat(file);
}

taft.Taft = Taft;

function Taft(options, data) {
    options = options || {};
    this.__data = data || {};

    HH.register(Handlebars, {});
    Handlebars.registerHelper(options.helpers || {});
    this._helpers = options.helpers || {};
    
    registerPartials(options.partials || []);

    if (options.verbose) {
        console.error('registered partials:', Object.keys(Handlebars.partials).join(', '));
        console.error('registered helpers:', Object.keys(Handlebars.helpers).join(', '));
    }

    if (options.layout) {
        Handlebars.registerPartial('body', '');

        var _layout = new Taft({}, data);
        var _template = _layout.template(options.layout);

        this.layout = function(content, data) {
            Handlebars.registerPartial('body', content);

            try {
                var page = _template({page: data});    
                Handlebars.registerPartial('body', '');
                return page;
            } catch (e) {

                throw('Unable to render page: ' + e.message);
            }

        };
    }
}

Taft.prototype.template = function(file) {
    var raw;

    try {
        raw = fs.readFileSync(file, {encoding: 'utf8'});
    } catch (err) {
        if (err.code == 'ENOENT') raw = file;
        else throw(err);
    }

    var source = YFM(raw);

    // class data extended by current context
    var _data = extend(source.context, this.__data);
    var compile = Handlebars.compile(source.content.trimLeft(), {knownHelpers: this._helpers});

    var _template = function(data) {
        var d = extend(_data, data || {});
        return compile(d);
    };

    _template.data = _data;
    return _template;
};

Taft.prototype.extend = function(data) {
    this.data = extend(this.__data, data);
    return this;
};

Taft.prototype.eat = function(file, data) {
    var template = this.template(file);
    var content = template(data);

    if (this.layout) {
        data = extend(template.data, data || {});
        return this.layout(content, data || {});
    }
    else return content;
};

var registerPartials = function(partials) {
    if (typeof(partials) == 'string')
        partials = [partials];

    if (Array.isArray(partials))
        for (var i = 0, len = partials.length, p; i < len; i++){
            p = partials[i];
            try {
                Handlebars.registerPartial(path.basename(p, path.extname(p)), fs.readFileSync(p, {encoding: 'utf-8'}));
            } catch (err) {
                console.error("Could not register partial: " + path.basename(p, path.extname(p)));
            }
        }

    else if (typeof(partials) === 'object')
        for (var name in partials)
            if (partials.hasOwnProperty(name))
                Handlebars.registerPartial(name, partials[name]);
};
