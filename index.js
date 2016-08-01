'use strict';

const 
	SwaggerParser = require('swagger-parser');

const 
	SWAGGER_VER 			= '2.0',
	VERB_REG_EXP 			= /^(OPTIONS|GET|HEAD|POST|PUT|PATCH|DELETE|TRACE)[\s\S]+$/i,
	VERB_REPLACE_REG_EXP 	= /^(OPTIONS|GET|HEAD|POST|PUT|PATCH|DELETE|TRACE)\s/i,
	PATH_REG_EXP 			= /:(\w+)\??/g,
	SWAGGER_VAR_FORMAT 		= '{$1}',
	SAILS_DEFAULT_VERB 		= 'get',
	DEFAULT_HOST 			= 'localhost:8080' 

module.exports = function sailsRoutesSwagger (sails) {

    return {
        initialize: function (cb) {
            sails.after('router:after', () => {
                let pathResults = generateSwaggerPathObjects(sails.config.routes);

                let swaggerConfig = sails.config[this.configKey];

                let swaggerJSON = {
                    swagger 		 	: SWAGGER_VER,
                    info 			 	: converPackageToSwagger(swaggerConfig.package),
                    host 			 	: swaggerConfig.host || DEFAULT_HOST,
                    tags 			 	: mergeTags(swaggerConfig.tags || [], pathResults.tags),
                    definitions 	 	: swaggerConfig.definitions || {},
                    securityDefinitions : swaggerConfig.securityDefinitions || {},
                    paths 				: pathResults.paths,
                    externalDocs 		: swaggerConfig.externalDocs
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
                'GET /swagger/ui': function (req, res) {
                    res.status(200).json(sails.hooks[this.configKey]);
                }
            }
        }
    };
}

function generateSwaggerPathObjects (routes) {
    let routesToSkip = ['/*', '/__getcookie', '/csrfToken', '/csrftoken'];

    let ctrlTags = new Set();

    function __isObject(o) {
        return Object.prototype.toString.call(o) === '[object Object]';
    }

    let paths = Object.keys(routes).reduce((docRoutes, url) => {
        let routeHandler = routes[url];

        if (__isObject(routeHandler) && __isObject(routeHandler.swagger) && (routesToSkip.indexOf(url) === -1)) {
            let verbMatch 		= url.match(VERB_REG_EXP),
            	verb 			= verbMatch && verbMatch[1] || SAILS_DEFAULT_VERB,
            	path 			= url.replace(PATH_REG_EXP, SWAGGER_VAR_FORMAT).replace(VERB_REPLACE_REG_EXP, '');

            /*
            * If swagger object does not contain tags, 
            * create new tag with name and description set to controller's name
            * and add the tag to swagger object
            */
            if(!(routeHandler.swagger && routeHandler.swagger.length)) {
            	let tagName 				= routeHandler.controller
            	routeHandler.swagger.tags 	= [tagName];
            	ctrlTags.add({ name: tagName, description: tagName });
            }

            docRoutes[path] = docRoutes[path] || {};

            if(docRoutes[path][verb]) {
            	throw new Error('Duplicate routes');
            }

            docRoutes[path][verb] 	= routeHandler.swagger;
        }

        return docRoutes;
    }, {});

    return {
    	paths 		: paths,
    	tags 		: Array.from(ctrlTags)
    }
}

function converPackageToSwagger (pkg) {
    if (!pkg) {
        throw new Error('Package.json object required');
    }

    return {
        title 		: pkg.name,
        description : pkg.description,
        version 	: pkg.version,
        contact 	: {
            name		: pkg.author,
            url 		: pkg.homepage
        },
        license 	: {
            name 		: pkg.license
        }
    }
}

function mergeTags (configTags, createdTags) {
	let resultTags = configTags.slice();

	for(let tag of createdTags) {
		let exists = false;

		for(let confTag of configTags) {
			if(confTag.name.toLowerCase() === tag.name.toLowerCase()) {
				exists = true;
				break;
			}
		}

		if(!exists) {
			resultTags.push(tag);
		}
	}

	return resultTags;
}
