'use strict';

const 
	SwaggerParser 	= require('swagger-parser'),
	docGen 			= require('./lib/doc-generator');

const 
	SWAGGER_VER 			= '2.0',
	DEFAULT_HOST 			= 'localhost:8080';

module.exports = function sailsRoutesSwagger (sails) {
	let configKey;

    return {
        initialize: function (cb) {
        	configKey = this.configKey;
            sails.after('router:after', () => {
                let pathResults = docGen.generateSwaggerPathObjects(sails.config.routes);

                let swaggerConfig = sails.config[this.configKey];

                let swaggerJSON = {
                    swagger 		 	: SWAGGER_VER,
                    info 			 	: docGen.convertPackageToSwagger(swaggerConfig.package),
                    host 			 	: swaggerConfig.host || DEFAULT_HOST,
                    tags 			 	: docGen.mergeTags(swaggerConfig.tags || [], pathResults.tags),
                    definitions 	 	: swaggerConfig.definitions || {},
                    securityDefinitions : swaggerConfig.securityDefinitions || {},
                    paths 				: pathResults.paths,
                    externalDocs 		: swaggerConfig.externalDocs || { url: DEFAULT_HOST }
                };

                /*
				* Docs: https://github.com/BigstickCarpet/swagger-parser/blob/master/docs/swagger-parser.md#api
                */
                SwaggerParser.validate(swaggerJSON, (err, api) => {
                	if(err) {
                		throw err;
                	} else {
                		sails.hooks[this.configKey] = api;
                	}
                });
            });

            cb();
        },
        routes: {
            after: {
                'GET /swagger/ui': (req, res) => {
                    res.status(200).json(sails.hooks[configKey]);
                }
            }
        }
    };
}
