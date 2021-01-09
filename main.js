const fs = require('fs')
const path = require('path')
const CodeWriter = require('./code-writer')

function generateCode(diagram, folder) {
  diagram.ownedViews
    .filter((view) => view instanceof type.UMLClassView)
    .map((classView) => classView.model)
    .filter((umlClass) => umlClass.stereotype === 'Table')
    .forEach((table) => {
      const writer = new CodeWriter()

      // do something badass here!

      fs.writeFileSync(path.join(folder, `${table.name}.php`), writer.getData())
    })
}

function handleGenerateCommand(diagram, folder) {
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
            let files = app.dialogs.showOpenDialog(
              'Select a folder where generated codes to be located',
              null,
              null,
              { properties: ['openDirectory'] }
            )

            if (files && files.length > 0) {
              folder = files[0]
              generateCode(diagram, folder)
            }
          } else {
            generateCode(diagram, folder)
          }
        }
      })
  } else {
    // If folder is not assigned, popup Open Dialog to select a folder
    if (!folder) {
      var files = app.dialogs.showOpenDialog(
        'Select a folder where generated codes to be located',
        null,
        null,
        { properties: ['openDirectory'] }
      )
      if (files && files.length > 0) {
        folder = files[0]
        generateCode(diagram, folder)
      }
    } else {
      generateCode(diagram, folder)
    }
  }
}

function init() {
  app.commands.register('laravel:generate', handleGenerateCommand)
}

exports.init = init
