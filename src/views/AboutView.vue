<template>
  <div class="p-5">
    <h1 class="text-2xl font-bold text-gray-800 mb-4">About TwinCity3000</h1>

    <p class="text-base leading-relaxed mb-4">
      TwinCity3000 is an open-source framework for working with urban digital twins at the district
      scale, consisting of two main components:
    </p>

    <div class="mb-6 space-y-4">
      <div class="bg-gray-50 p-4 rounded-lg">
        <h2 class="text-xl font-semibold mb-2">TwinCityViewer</h2>
        <p class="text-base leading-relaxed">
          A web-based tool for visualizing and interactively editing 3D city models. It implements
          visual-first operations for intuitive building model management and features extensive
          data fusion capabilities through MapLibre integration. The viewer supports loading of
          <a href="https://www.cityjson.org/cityjsonseq/"
            class="text-blue-600 hover:text-blue-800 underline">CityJSONSeq</a>
          data from both local files and through compatible APIs.
        </p>
      </div>

      <div class="bg-gray-50 p-4 rounded-lg">
        <h2 class="text-xl font-semibold mb-2">TwinCityAPI</h2>
        <p class="text-base leading-relaxed">
          Provides standardized interfaces following
          <a href="https://ogcapi.ogc.org/" class="text-blue-600 hover:text-blue-800 underline">OGC API</a>
          specifications for Features and Processes. Built with FastAPI and utilizing
          <a href="https://github.com/RWTH-E3D/CityDPC" class="text-blue-600 hover:text-blue-800 underline">CityDPC</a>,
          it enables efficient data delivery using CityJSONSeq encoding and supports complex
          operations like party wall calculations. If this viewer comes with a pre-configured API
          endpoint, you can find the
          <a :href="docuLink" class="text-blue-600 hover:text-blue-800 underline">API documentation here</a>.
        </p>
      </div>
    </div>

    <div class="bg-blue-50 p-4 rounded-lg mb-6">
      <h2 class="text-lg font-semibold mb-2">Technical Standards</h2>
      <p class="text-base leading-relaxed">
        TwinCity3000 uses open standards for data representation (
        <a href="https://www.cityjson.org/specs/" class="text-blue-600 hover:text-blue-800 underline">CityJSON</a>/
        <a href="https://www.ogc.org/standards/citygml" class="text-blue-600 hover:text-blue-800 underline">CityGML</a>)
        and APIs (OGC API
        <a href="https://ogcapi.ogc.org/features/" class="text-blue-600 hover:text-blue-800 underline">Features</a>/<a
          href="https://ogcapi.ogc.org/processes/" class="text-blue-600 hover:text-blue-800 underline">Processes</a>) to
        ensure interoperability and extensibility.
      </p>
    </div>

    <div class="text-sm text-gray-600">
      <p class="mb-2">Version: 0.1.0</p>
      <p class="mb-2">
        Developed as part of a master thesis at the
        <a href="https://www.e3d.rwth-aachen.de/" class="text-blue-600 hover:text-blue-800 underline">Institute of
          Energy Efficiency and Sustainable Building</a>
      </p>
      <p>
        For documentation and source code, click:<a href="https://github.com/RWTH-E3D/twin-city-viewer"
          class="text-blue-600 hover:text-blue-800 underline">here for the TwinCityViewer</a>
        or
        <a href="https://github.com/RWTH-E3D/twin-city-api" class="text-blue-600 hover:text-blue-800 underline">here for
          the TwinCityAPI</a>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
const docuLink: string | undefined = import.meta.env.VITE_BACKEND_DOCU
</script>
