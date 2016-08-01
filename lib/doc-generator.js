'use strict';

const 
	VERB_REG_EXP 			= /^(OPTIONS|GET|HEAD|POST|PUT|PATCH|DELETE|TRACE)[\s\S]+$/i,
	VERB_REPLACE_REG_EXP 	= /^(OPTIONS|GET|HEAD|POST|PUT|PATCH|DELETE|TRACE)\s/i,
	PATH_REG_EXP 			= /:(\w+)\??/g,
	SWAGGER_VAR_FORMAT 		= '{$1}',
	SAILS_DEFAULT_VERB 		= 'get';

module.exports = { generateSwaggerPathObjects, converPackageToSwagger, mergeTags };

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
            if(!(routeHandler.swagger.tags && routeHandler.swagger.tags.length)) {
            	let tagName 				= routeHandler.controller;
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