// Large subtitle scripts must be a file part; multipart text fields are capped at 1 MiB.
export function appendExportOptions(form:FormData,options:unknown){form.append('options_data',new Blob([JSON.stringify(options)],{type:'application/json'}),'render-options.json');}
