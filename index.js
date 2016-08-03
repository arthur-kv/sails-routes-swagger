'use strict';

const 
	SwaggerParser 	= require('swagger-parser'),
	fs 				= require('mz/fs'),
	path 			= require('path'),
	mime 			= require('mime'),
	docGen 			= require('./lib/doc-generator');

const 
	SWAGGER_VER 			= '2.0',
	DEFAULT_HOST 			= 'localhost:8080';

module.exports = function sailsRoutesSwagger (sails) {
	let configKey;

    return {
        initialize: function (cb) {

        	configKey = this.configKey;

        	let _log = sails.log.verbose.bind(null, `"${configKey}"`);

            sails.after('router:after', () => {
                let swaggerConfig = sails.config[this.configKey];

                let projectDocs = {
                	all: generateSwaggerDoc(sails.config.routes, swaggerConfig)
                };

                _log('Generated swagger json for the whole project');

                if (swaggerConfig.projects && swaggerConfig.projects.length) {
                	swaggerConfig.projects.reduce((docs, projectConfig) => {
                		docs[projectConfig.name] = generateSwaggerDoc(sails.config.routes, swaggerConfig, projectConfig)
                		_log(`Generated swagger json for "${projectConfig.name}" subproject`);
                		return docs;
                	}, projectDocs);
                }

                _log('Validating generated swagger docs');

                Promise.all(
                	Object.keys(projectDocs).map(prKey => {
                		return validateSwaggerDoc(projectDocs[prKey])
                	})
                ).then(() => {
                	if(swaggerConfig.docsFolder) {
                		_log('Writing json files');
                		return writeSwaggerDocs(_log, projectDocs, swaggerConfig.docsFolder);
                	}
                }).catch(err => {
                	sails.log.error(err);
                	throw err;
                });
            });

            cb();
        },
        routes: {
            after: {
                'GET /swagger/ui/:project': (req, res) => {
                	let destinationDir = sails.config[configKey].docsFolder;

                	if(!destinationDir) {
                		res.statusCode = 500;
                		res.end('Docs folder is not specified');
                		return;
                	}
                	
                	let filepath = path.resolve(destinationDir, `${req.params.project}.json`);

					let rStream = fs.createReadStream(filepath);

  					rStream.pipe(res);

  					rStream.on('error', err => {
  						if(err.code == 'ENOENT') {
  							res.statusCode = 404;
  							res.end('Not Found');
  						} else {
  							sails.log.error(err);
  							if(!res.headersSent) {
  								res.statusCode = 500;
  								res.end('Internal Error');
  							} else {
  								res.end();
  							}
  						}
  					}).on('open', () => {
  						res.setHeader('Content-Type', mime.lookup(filepath));
  					});

  					res.on('close', () => {
				    	rStream.destroy();
				    });
                }
            }
        }
    };
}

function generateSwaggerDoc (routes, swaggerConfig, projectConfig) {
	let pathResults = docGen.generateSwaggerPathObjects(routes, projectConfig && projectConfig.name);

    return {
        swagger 		 	: SWAGGER_VER,
        info 			 	: Object.assign(
        							projectConfig && projectConfig.info || {}, 
        							docGen.convertPackageToSwagger(swaggerConfig.package)
        					  ),
        host 			 	: swaggerConfig.host || DEFAULT_HOST,
        tags 			 	: docGen.mergeTags(swaggerConfig.tags || [], pathResults.tags),
        definitions 	 	: swaggerConfig.definitions || {}, // should I place definitions under project config either?
        securityDefinitions : swaggerConfig.securityDefinitions || {},
        paths 				: pathResults.paths,
        externalDocs 		: swaggerConfig.externalDocs || { url: DEFAULT_HOST }
    };
}

function validateSwaggerDoc (doc) {
	/*
	* Docs: https://github.com/BigstickCarpet/swagger-parser/blob/master/docs/swagger-parser.md#api
    */
	return SwaggerParser.validate(doc);
}

function writeSwaggerDocs (log, projects, dest) {
	return Object.keys(projects).map(prName => {
		let filepath = path.resolve(dest, `${prName.toLowerCase().replace(' ', '_')}.json`);

		log('Writing', filepath);

		return fs.writeFile(filepath, JSON.stringify(projects[prName], null, '  '), {
			encoding: 'utf8'
		})
	});
}
