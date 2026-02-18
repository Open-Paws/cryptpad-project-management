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

var normalizePath = function (p) {
    var resolved = Path.resolve(p);
    return Path.sep === '\\' ? resolved.toLowerCase() : resolved;
};

var isPathInside = function (candidate, root) {
    if (typeof(candidate) !== 'string' || typeof(root) !== 'string') { return false; }
    var resolvedCandidate = normalizePath(candidate);
    var resolvedRoot = normalizePath(root);
    if (resolvedCandidate === resolvedRoot) { return true; }
    return resolvedCandidate.indexOf(resolvedRoot + Path.sep) === 0;
};

var realpath = function (path) {
    try {
        if (Fs.realpathSync.native) { return Path.resolve(Fs.realpathSync.native(path)); }
        return Path.resolve(Fs.realpathSync(path));
    } catch (err) {
        return null;
    }
};

var getRealPathEntry = function (root) {
    if (typeof(root) !== 'string') { return null; }
    var configured = Path.resolve(root);
    var real = realpath(configured);
    if (!real) { return null; }
    return {
        configured: configured,
        real: real,
    };
};

var resolvePathWithinRoot = function (candidate, rootEntry) {
    if (typeof(candidate) !== 'string' || !rootEntry) { return null; }
    var resolvedCandidate = Path.resolve(candidate);
    if (!isPathInside(resolvedCandidate, rootEntry.configured)) { return null; }
    var relative = Path.relative(rootEntry.configured, resolvedCandidate);
    return Path.resolve(rootEntry.real, relative);
};

var getExistingAncestorRealpath = function (candidate) {
    if (typeof(candidate) !== 'string') { return null; }
    var cursor = Path.resolve(candidate);
    while (true) {
        var real = realpath(cursor);
        if (real) {
            return {
                path: cursor,
                real: real,
            };
        }
        var parent = Path.dirname(cursor);
        if (parent === cursor) { return null; }
        cursor = parent;
    }
};

var getStorageRoots = function (Env) {
    if (!Env || !Env.paths) { return []; }
    var roots = [Env.paths.base, Env.paths.archive]
        .map(getRealPathEntry)
        .filter(Boolean);
    return roots.filter(function (root, i, all) {
        return all.findIndex(function (r) {
            return r.real === root.real;
        }) === i;
    });
};

var isValidStoragePath = function (Env, path) {
    if (!Env || !Env.paths || typeof(path) !== 'string') { return false; }
    return getStorageRoots(Env).some(function (root) {
        var resolvedCandidate = resolvePathWithinRoot(path, root);
        if (!resolvedCandidate) { return false; }
        var ancestor = getExistingAncestorRealpath(resolvedCandidate);
        if (!ancestor) { return false; }
        var relative = Path.relative(ancestor.path, resolvedCandidate);
        var canonicalCandidate = Path.resolve(ancestor.real, relative);
        return isPathInside(canonicalCandidate, root.real);
    });
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
