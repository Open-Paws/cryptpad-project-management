// SPDX-FileCopyrightText: 2023 XWiki CryptPad Team <contact@cryptpad.org> and contributors
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/*  Mulfi-factor auth requires some rudimentary storage methods
    for a number of data types:

* "challenges" (described in challenge.js)
* account settings for MFA (described in mfa.js)
* session tokens (described in sessions.js)

Each data type requires the same three simple methods:

* read
* write
* delete

These could be implemented as tables in a relational database, but committing to a relational DB
is a big decision, so these methods are instead implemented using the filesystem, with each
file's path and naming convention implemented outside of this module.

Feel free to migrate all of these to a relational DB at some point in the future if you like.

*/

const Basic = module.exports;
const Fs = require("node:fs");
const Fse = require("fs-extra");
const Path = require("node:path");

var pathError = (cb) => {
    setTimeout(function () {
        cb(new Error("INVALID_PATH"));
    });
};

var isPathInside = function (candidate, root) {
    if (typeof(candidate) !== 'string' || typeof(root) !== 'string') { return false; }
    var resolvedCandidate = Path.resolve(candidate);
    var resolvedRoot = Path.resolve(root);
    if (resolvedCandidate === resolvedRoot) { return true; }
    return resolvedCandidate.indexOf(resolvedRoot + Path.sep) === 0;
};

var isValidStoragePath = function (Env, path) {
    if (!Env || !Env.paths || typeof(path) !== 'string') { return false; }
    var base = Env.paths.base;
    var archive = Env.paths.archive;
    return isPathInside(path, base) || isPathInside(path, archive);
};

Basic.read = function (Env, path, cb) {
    if (!path || !isValidStoragePath(Env, path)) { return void pathError(cb); }
    Fs.readFile(path, 'utf8', (err, content) => {
        if (err) { return void cb(err); }
        cb(void 0, content);
    });
};
Basic.readDir = function (Env, path, cb) {
    if (!path || !isValidStoragePath(Env, path)) { return void pathError(cb); }
    Fs.readdir(path, cb);
};
Basic.readDirSync = function (Env, path) {
    if (!path || !isValidStoragePath(Env, path)) { return []; }
    return Fs.readdirSync(path);
};

Basic.write = function (Env, path, data, cb) {
    if (!path || !isValidStoragePath(Env, path)) { return void pathError(cb); }
    var dirpath = Path.dirname(path);
    Fs.mkdir(dirpath, { recursive: true }, function (err) {
        if (err) { return void cb(err); }
        // the 'wx' flag causes writes to fail with EEXIST if a file is already present at the given path
        // this could be overridden with options in the future if necessary, but it seems like a sensible default
        Fs.writeFile(path, data, { flag: 'wx', }, cb);
    });
};

// TODO I didn't bother implementing the usual "archive/restore/delete-from-archives" methods
// because they didn't seem particularly important for the data implemented with this module.
// They're still worth considering, though, so don't let my ommission stop you.
// Login blocks could probably be implemented with this module if these methods were supported.
// --Aaron
Basic.delete = function (Env, path, cb) {
    if (!path || !isValidStoragePath(Env, path)) { return void pathError(cb); }
    Fs.rm(path, cb);
};
Basic.deleteDir = function (Env, path, cb) {
    if (!path || !isValidStoragePath(Env, path)) { return void pathError(cb); }
    Fs.rm(path, { recursive: true, force: true }, cb);
};

Basic.archive = function (Env, path, archivePath, cb) {
    if (!isValidStoragePath(Env, path) || !isValidStoragePath(Env, archivePath)) {
        return void pathError(cb);
    }
    Fse.move(path, archivePath, {
        overwrite: true,
    }, (err) => {
        cb(err);
    });
};
Basic.restore = function (Env, archivePath, path, cb) {
    if (!isValidStoragePath(Env, archivePath) || !isValidStoragePath(Env, path)) {
        return void pathError(cb);
    }
    Fse.move(archivePath, path, {
        //overwrite: true,
    }, (err) => {
        cb(err);
    });
};
