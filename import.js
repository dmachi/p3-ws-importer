#!/usr/bin/env node
var conf = require('./config');
var fs = require("fs-extra");
var defer = require("promised-io/promise").defer;
var when = require("promised-io/promise").when;
var All = require("promised-io/promise").all;
var Path = require('path');
var xhr = require('request');

if ( !conf.get('workspaceServiceURL')) {
	throw new Error("Workspace Service url must be configured in p3-ws-importer.conf or with --workspacServiceURL");
}


console.log("Running p3-ws-importer...");
console.log("Workspace Service: ", conf.get('workspaceServiceURL'));
console.log("Importing Path '" + conf.get('path') + "' to workspace '" + conf.get("workspace") + "'");
console.log("Auth Token: ",conf.get('authorizationToken'));
console.log("Import as admin: ", conf.get("admin"));
var aliases = conf.get("aliases");
var types = conf.get('types');
var adminmode = !!conf.get("admin");
var owner = conf.get('owner');

if (adminmode && !owner){
	throw Error("Owner of imported workspace files must be supplied when using admin mode.");
}
if (types!="*") {
	types = types.split(",");
	conf.set('types', types);
}

console.log("Import types: ", types);
var idx=0;
function rpc(method, params){
	var def = new defer();
	var body = {id: idx++, method: method, params: params}
	xhr({
		url: conf.get("workspaceServiceURL"),
		method: "POST",
		json: true,
		body: body,
		headers: {
			authorization: conf.get('authorizationToken')
		}
	}, function(err,response,rbody){
//		console.log("RPC err: ", err, rbody, response);
		if (err) { console.log("Reponse body: ", rbody); return def.reject(err); }
		if (rbody && rbody.error) {
			console.log("rbody.error", rbody.error);			
			return def.reject(rbody.error); 
		}

		if (rbody && rbody.result){
			def.resolve(rbody.result);
		}
	});

	return def.promise;
}

function getFileList(path) {
	var def = new defer();
	fs.readdir(path, function(err, files){
		if (err) { return def.reject(err); }
		def.resolve(files);
	});
	return def.promise;
}

function getRelativePath(path){
	return path.replace(conf.get('path'),"");
}

function ensureWorkspaceFolder(path){
	//console.log("Ensure Workspace Folder: ", path);
	return when(rpc("Workspace.get", [{objects: [path],metadata_only: true,adminmode: adminmode}]), function(r){
		var obj = {
			name: r[0][0][0][0],
			type: r[0][0][0][1],
			path: r[0][0][0][2],
			creation_time: r[0][0][0][3],
			id: r[0][0][0][4],
			owner_id: r[0][0][0][5],
			size: r[0][0][0][6],
			userMeta: r[0][0][0][7],
			autoMeta: r[0][0][0][8],
			user_permissions: r[0][0][0][9],
			global_permission: r[0][0][0][10],
			link_reference: r[0][0][0][11]
		}
	//	console.log("Got Obj: ", obj);
		if (obj && obj.type && obj.type=="folder" && obj.path && obj.name && (Path.join(obj.path,obj.name)==path) && obj.id) {
	//		console.log("Found Existing Folder: ", path);
			return true;
		}else{
			console.log("Folder Not Found: ", path, " Creating Workspace Folder.");
			return when(rpc("Workspace.create", [{objects: [[path,"Directory"]],adminmode:adminmode,setowner:(adminmode)?owner:""}]), function(results){
					if (!results[0][0] || !results[0][0]) {
                                                throw new Error("Error Creating Folder");
                                        }else{
                                                var r = results[0][0];
                                                var out = {
                                                        id: r[4],
                                                        path: r[2] + r[0],
                                                        name: r[0],
                                                        type: r[1],
                                                        creation_time: r[3],
                                                        link_reference: r[11],
                                                        owner_id: r[5],
                                                        size: r[6],
                                                        userMeta: r[7],
                                                        autoMeta: r[8],
                                                        user_permission: r[9],
                                                        global_permission: r[10]
                                                }
                                                return out;
                                        }
			});
		}
	});	
}

function importFile(filename,path,dest){
	var fp = Path.join(path,filename);
	var metafp = Path.join(path, "_" + filename + ".metadata");
	var def = new defer();
	fs.exists(metafp, function(exists){
		var metadata={}
		if (exists) {
			metadata=new defer();
			fs.readJson(metafp, function(err,data){
				if (err) { return def.reject(err); }
				metadata.resolve(data)
			});
		}	

		when(metadata, function(metadata){
			metadata.name = metadata.name || filename;
			metadata.type = metadata.type || "unspecified";
			if (aliases && aliases[metadata.type]) { metadata.type=aliases[metadata.type] }

			console.log("File Metadata: ", metadata);

			if (types=="*" || (types instanceof Array && (types.indexOf(metadata.type)>=0))){
			
				fs.readFile(fp, {encoding: "utf8"}, function(err,data){
					if (err) { return def.reject("Unable to read file: " + fp);}

					console.log("Create/Overwrite file: ", Path.join(dest,metadata.name), "type: ", metadata.type);
//					console.log("file data: ", data);
					var up = [Path.join(dest,metadata.name),metadata.type,{},data]
					when(rpc("Workspace.create",[{objects:[up],overwrite:true,createUploadNodes:false,adminmode:adminmode, setowner:(adminmode)?owner:""}]), function(results){
						if (!results[0][0] || !results[0][0]) {
							def.reject("Error Creating Object");
						}else{
	                                                var r = results[0][0];
							var out = {
	                                                        id: r[4],
								path: r[2] + r[0],
	                                                        name: r[0],
								type: r[1],
								creation_time: r[3],
								link_reference: r[11],
								owner_id: r[5],
								size: r[6],
								userMeta: r[7],
								autoMeta: r[8],
								user_permission: r[9],
								global_permission: r[10]
							}
							console.log("Create Obj Results: ",out );
	                                                def.resolve(out); 
						}
					}, function(err){
						console.log("Error creating file: ", err);
						def.reject(err);
					});
				});	
			}else{
				console.log("Skipping file type: ", metadata.type, " file: ", Path.join(dest,metadata.name));
				def.resolve(true);
			}
		});
	})
	return def.promise;
}

function doImport(path, dest) {

	if (!dest) {
		dest=conf.get('workspace');
	}
	var defs = [];
	getFileList(path).then(function(files){
		files.forEach(function(file) {
			console.log("STAT: ", Path.join(path,file));
			fs.stat(Path.join(path,file), function(err,stats){
				if (err) { console.error("Error checking ", file, err); return def.reject(err); }
				if (stats.isDirectory()){
					defs.push(when(ensureWorkspaceFolder(Path.join(dest,file)), function(destFolder){
						return doImport(Path.join(path,file),Path.join(dest,file));	
					}));
				}else{
					console.log("Add WS File: ", Path.join(path,file));
					if ((file.charAt(0)=="_") && file.match(/\.metadata$/)){
						//console.log("Skip Metadata file: ", file);
						return;
					}
					defs.push(importFile(file, path, dest));
				}
			});
		});
	});
	return All(defs);
}

doImport(conf.get('path')).then(function(){ console.log("Import Complete") });

