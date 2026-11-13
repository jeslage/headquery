<?php

// headquery playground: replaces the default config/statamic/api.php.

return [

    'enabled' => env('STATAMIC_API_ENABLED', false),

    /*
    | Exposed resources. `allowed_filters` mirrors the `filterable` fields of
    | spec/statamic/fixtures/schema.json.
    */
    'resources' => [
        'collections' => [
            'blog' => ['allowed_filters' => ['title', 'slug', 'featured']],
        ],
        'navs' => [
            'main' => true,
        ],
        'taxonomies' => [
            'tags' => ['allowed_filters' => ['title']],
        ],
        'assets' => [
            // basename and folder are system fields: exported as `systemFilters`.
            'assets' => ['allowed_filters' => ['alt', 'basename', 'folder']],
        ],
        'globals' => [
            'settings' => true,
        ],
        'forms' => false,
        'users' => false,
    ],

    'route' => env('STATAMIC_API_ROUTE', 'api'),

    'middleware' => env('STATAMIC_API_MIDDLEWARE', 'api'),

    'pagination_size' => 50,

    // Off in the playground so content edits show up immediately.
    'cache' => false,

];
