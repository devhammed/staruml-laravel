const fs = require('fs')
const path = require('path')
const { noCase } = require('change-case')
const CodeWriter = require('./code-writer')

function generateCode (diagram, folder) {
  diagram.ownedViews
    .filter(view => view instanceof type.UMLClassView)
    .map(classView => classView.model)
    .filter(umlClass => umlClass.stereotype === 'Table')
    .forEach(table => {
      const date = new Date()
      const writer = new CodeWriter()
      const tableName = noCase(table.name, {
        transform: (part, index, parts) =>
          `${part}${parts.length - 1 === index ? '' : '_'}`.toLowerCase()
      })

      // do something badass here!

      // Laravel Migrations file format: <year>_<month>_<day>_<hour><minute><second>_create_<table>_table.php
      fs.writeFileSync(
        path.join(
          folder,
          `${date.getFullYear()}_${date.getMonth() +
            1}_${date.getDate()}_${date.getHours()}${date.getMinutes()}${date.getSeconds()}_create_${tableName}_table.php`
        ),
        writer.getData()
      )
    })
}

function getOutputFolderAndGenerateCode (diagram) {
  const files = app.dialogs.showOpenDialog(
    'Select a folder where generated codes to be located',
    null,
    null,
    { properties: ['openDirectory'] }
  )

  if (files && files.length > 0) {
    generateCode(diagram, files[0])
  }
}

function handleGenerateCommand (diagram, folder) {
  // If diagram is not assigned, popup ElementPicker
  if (!diagram) {
    app.elementPickerDialog
      .showDialog(
        'Select a class diagram to generate the classes migrations',
        null,
        type.UMLClassDiagram
      )
      .then(function ({ buttonId, returnValue }) {
        if (buttonId === 'ok') {
          diagram = returnValue

          // If folder is not assigned, popup Open Dialog to select a folder
          if (!folder) {
            getOutputFolderAndGenerateCode(diagram)
          } else {
            generateCode(diagram, folder)
          }
        }
      })
  } else if (!folder) {
    getOutputFolderAndGenerateCode(diagram)
  } else {
    generateCode(diagram, folder)
  }
}

function init () {
  app.commands.register('laravel:generate', handleGenerateCommand)
}

exports.init = init
