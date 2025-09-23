# TwinCityViewer

TwinCityViewer is a web-based visualization and editing tool for 3D city models in the [CityJSONSeq format](https://www.cityjson.org/cityjsonseq/). It provides an intuitive interface for working with district-scale urban digital twins, supporting both visualization and interactive editing capabilities. While it can work with any OGC API Features compliant endpoint, it is designed to work seamlessly with [TwinCityAPI](https://github.com/RWTH-E3D/twin-city-api) for enhanced functionality.

## Key Features

- Interactive 3D visualization using Three.js
- Integration with MapLibre GL for base maps and terrain data
- Visual-first CRUD operations for building models
- Direct editing of building geometries and properties
- Compatible with any OGC API Features compliant endpoint
- Local file saving and loading capabilities

## License

Available under the Apache 2.0 [License](License.md).
See the _Cite this repository_ function or the [CITATION.cff](CITATION.cff) for citation of this repository.

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Project Setup

Make sure to create a .env file if you are not using the docker image based on
the [examle](sample.env)

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).
