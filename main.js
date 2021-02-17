const fs = require('fs')
const path = require('path')
const { noCase, pascalCase } = require('change-case')

const baseEnum = require('./base-enum')
const CodeWriter = require('./code-writer')
const columnTypes = require('./column-types')

/**
 * Generate a database compatible table name for UML class.
 *
 * @param {string} name
 * @returns {string}
 */
function sanitizeTableName (name) {
  return noCase(name, {
    transform: (part, index, parts) =>
      `${part}${parts.length - 1 === index ? '' : '_'}`.toLowerCase()
  })
    .split(' ')
    .join('')
}

/**
 * Generate Laravel Migrations Timestamp.
 *
 * @returns {string} year_month_day_hourMinuteSecond
 */
function getMigrationTimestamp () {
  const date = new Date()

  return `${date.getFullYear()}_${date.getMonth() +
    1}_${date.getDate()}_${date.getHours()}${date.getMinutes()}${date.getSeconds()}`
}

/**
 * Check if UML class is a table.
 *
 * @param {type.UMLClass} umlClass
 * @returns {boolean}
 */
function isClassATable (umlClass) {
  return umlClass.stereotype.toLowerCase() === 'table'
}

/**
 * Get model views from diagram.
 *
 * @param {type.UMLClassDiagram} diagram
 * @param {type.UMLView} type
 * @returns {any[]}
 */
function getViews (diagram, type) {
  return diagram.ownedViews
    .filter(view => view instanceof type)
    .map(view => view.model)
}

function generateMigrations (diagram, folder) {
  const tables = getViews(diagram, type.UMLClassView).filter(isClassATable)
  const enumerations = getViews(diagram, type.UMLEnumerationView)
  const associations = getViews(diagram, type.UMLAssociationView).filter(
    association =>
      isClassATable(association.end1.reference) &&
      isClassATable(association.end2.reference)
  )

  if (!tables.length) {
    return app.toast.error('There is no migrations to generate!')
  }

  tables.forEach(table => {
    const writer = new CodeWriter()
    const ids = table.attributes
      .filter(attribute => attribute.isID)
      .map(attribute => `'${attribute.name}'`)
    const usedEnums = table.attributes
      .filter(attribute => attribute.type instanceof type.UMLEnumeration)
      .map(attribute => attribute.type.name)
    const timestampColumns = ['created_at', 'updated_at']
    const typesWithMultiplicity = [
      'set',
      'char',
      'time',
      'float',
      'double',
      'timeTz',
      'string',
      'decimal',
      'dateTime',
      'dateTimeTz',
      'softDeletes',
      'softDeletesTz',
      'unsignedDecimal'
    ]
    const databaseTableName = sanitizeTableName(table.name)

    writer.migration(
      `Create${pascalCase(table.name)}Table`,
      usedEnums.map(usedEnum => `use App\\Enums\\${usedEnum};`),
      writer => {
        writer.writeLine(
          `Schema::create('${databaseTableName}', function (Blueprint $table) {`
        )

        writer.indent()

        table.attributes
          .filter(attribute => timestampColumns.indexOf(attribute.name) === -1)
          .forEach(
            ({
              name,
              isID,
              isUnique,
              stereotype,
              multiplicity,
              defaultValue,
              documentation,
              type: dataType
            }) => {
              writer.writeLine('$table->')

              if (
                typeof dataType === 'string' &&
                columnTypes.indexOf(dataType) !== -1
              ) {
                writer.write(`${dataType}('${name}'`)

                if (
                  typesWithMultiplicity.indexOf(dataType) !== -1 &&
                  multiplicity !== ''
                ) {
                  writer.write(', ' + multiplicity.split('..').join(', '))
                }
              } else if (dataType instanceof type.UMLEnumeration) {
                writer.write(`enum('${name}', ${dataType.name}::values()`)
              } else {
                // I don't know what this person is thinking, let's just do `text` abeg...
                writer.write(`text('${name}'`)
              }

              writer.write(')')

              if (isUnique) {
                writer.write('->unique()')
              }

              if (defaultValue !== '') {
                if (defaultValue.toLowerCase() === 'null') {
                  writer.write('->nullable()')
                } else {
                  writer.write(
                    `->default(${
                      dataType instanceof type.UMLEnumeration
                        ? `${dataType.name}::${defaultValue}`
                        : defaultValue
                    })`
                  )
                }
              }

              // if we have multiple ids, we will handle it later...
              if (isID && ids.length <= 1) {
                writer.write('->primary()')
              }

              if (documentation !== '') {
                writer.write(
                  `->comment('${documentation.replace("'", "\\'")}')`
                )
              }

              writer.write(';')

              if (stereotype !== null) {
                const stereotypeLower = stereotype.toLowerCase()

                if (stereotypeLower === 'in' || stereotypeLower === 'index') {
                  return writer.writeLine(`$table->index('${name}');`)
                }
              }
            }
          )

        // handle composite keys
        if (ids.length > 1) {
          writer.writeLine(`$table->primary([${ids.join(', ')}]);`)
        }

        // handle timestamps
        if (
          table.attributes.some(
            attribute => timestampColumns.indexOf(attribute.name) !== -1
          )
        ) {
          writer.writeLine('$table->timestamps();')
        }

        writer.outdent()

        writer.writeLine('});')
      },
      writer => {
        writer.writeLine(`Schema::dropIfExists('${databaseTableName}');`)
      }
    )

    // Laravel Migrations file format: <timestamp>_create_<table>_table.php
    fs.writeFileSync(
      path.join(
        folder,
        `${getMigrationTimestamp()}_create_${databaseTableName}_table.php`
      ),
      writer.getData()
    )
  })

  if (enumerations.length > 0) {
    const enumsDir = path.join(folder, 'Enums')

    fs.mkdirSync(enumsDir)

    fs.writeFileSync(path.join(enumsDir, 'BaseEnum.php'), baseEnum)

    enumerations.forEach(({ name, literals }) => {
      const writer = new CodeWriter()
      const enumerationName = pascalCase(name)

      writer.writeLines([
        '<?php',
        '',
        'namespace App\\Enums;',
        '',
        `abstract class ${enumerationName} extends BaseEnum`,
        '{'
      ])

      writer.indent()

      literals.forEach(({ name, documentation }, index) => {
        if (documentation !== '') {
          writer.writeLine('/**')
          writer.writeLines(documentation.split('\n').map(line => ` * ${line}`))
          writer.writeLine(' */')
        }

        writer.writeLine(`public const ${name} = '${name}';`)

        // if not last item, add a blank line after definition...
        if (index !== literals.length - 1) {
          writer.writeLine('')
        }
      })

      writer.outdent()

      writer.writeLines(['}', ''])

      fs.writeFileSync(
        path.join(enumsDir, `${enumerationName}.php`),
        writer.getData()
      )
    })
  }

  app.toast.info(
    `${tables.length} migrations, ${enumerations.length} enums and ${associations.length} associations generated successfully.`
  )
}

function getOutputFolderAndGenerateMigrations (diagram) {
  const files = app.dialogs.showOpenDialog(
    'Select a folder where generated migrations will be located',
    null,
    null,
    { properties: ['openDirectory'] }
  )

  if (files && files.length > 0) {
    generateMigrations(diagram, files[0])
  }
}

function handleLaravelGenerateCommand (diagram, folder) {
  if (!diagram || !diagram instanceof type.UMLClassDiagram) {
    app.elementListPickerDialog
      .showDialog(
        'Select a class diagram to generate the migrations from',
        app.repository.select('@UMLClassDiagram')
      )
      .then(function ({ buttonId, returnValue }) {
        if (buttonId === 'ok') {
          if (!folder) {
            getOutputFolderAndGenerateMigrations(returnValue)
          } else {
            generateMigrations(returnValue, folder)
          }
        }
      })
  } else if (!folder) {
    getOutputFolderAndGenerateMigrations(diagram)
  } else {
    generateMigrations(diagram, folder)
  }
}

exports.init = function () {
  app.commands.register('laravel:generate', handleLaravelGenerateCommand)
}
