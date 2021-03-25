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
 * Get model views from diagram.
 *
 * @param {type.UMLClassDiagram} diagram
 * @param {type.UMLView} type
 * @returns {type.UMLObject[]}
 */
function getViews (diagram, type) {
  return diagram.ownedViews
    .filter(view => view instanceof type)
    .map(typeView => typeView.model)
}

/**
 * Get associated classes.
 *
 * @param {type.UMLClass} umlClass
 * @returns {type.UMLAssociation[]}
 */
function getClassAssociations (umlClass) {
  return umlClass.ownedElements.filter(
    element => element instanceof type.UMLAssociation
  )
}

function generateMigrations (diagram, folder) {
  const tables = getViews(diagram, type.UMLClassView).filter(
    umlClass => (umlClass.stereotype || '').toLowerCase() === 'table'
  )
  const enumerations = getViews(diagram, type.UMLEnumerationView)

  if (!tables.length) {
    return app.toast.error('There is no migrations to generate!')
  }

  tables
    .sort((a, b) => {
      if (getClassAssociations(b).some(dep => dep.end2.reference === a)) {
        return -1
      }

      if (getClassAssociations(a).some(dep => dep.end2.reference === b)) {
        return 1
      }

      return 0
    })
    .forEach((table, tableIndex) => {
      const date = new Date()
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

      writer.writeLines(
        ['<?php', ''].concat(
          usedEnums.map(usedEnum => `use App\\Enums\\${usedEnum};`),
          [
            'use Illuminate\\Support\\Facades\\Schema;',
            'use Illuminate\\Database\\Schema\\Blueprint;',
            'use Illuminate\\Database\\Migrations\\Migration;',
            '',
            `class Create${pascalCase(table.name)}Table extends Migration`,
            '{'
          ]
        )
      )

      writer.indent()

      writer.writeLines([
        '/**',
        ' * Run the migrations.',
        ' *',
        ' * @return void',
        ' */',
        'public function up()',
        '{'
      ])

      writer.indent()

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
              writer.write(`->comment('${documentation.replace("'", "\\'")}')`)
            }

            writer.write(';')

            if ((stereotype = (stereotype || '').toLowerCase())) {
              if (stereotype === 'in' || stereotype === 'index') {
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

      getClassAssociations(table).forEach(({ end1, end2 }, index, arr) => {
        writer.writeLine(`$table->foreign('${end1.name}')`)

        writer.indent()

        writer.writeLines([
          `->references('${end2.name}')`,
          `->on('${sanitizeTableName(end2.reference.name)}')`,
          `->onDelete('cascade');`
        ])

        writer.outdent()

        if (index !== arr.length - 1) {
          writer.writeLine('')
        }
      })

      writer.outdent()

      writer.writeLine('});')

      writer.outdent()

      writer.writeLines([
        '}',
        '',
        '/**',
        ' * Reverse the migrations.',
        ' *',
        ' * @return void',
        ' */',
        'public function down()',
        '{'
      ])

      writer.indent()

      writer.writeLine(`Schema::dropIfExists('${databaseTableName}');`)

      writer.outdent()

      writer.writeLine('}')

      writer.outdent()

      writer.writeLines(['}', ''])

      // Laravel Migrations file format: <year>_<month>_<day>_<hour><minute><second>_create_<table>_table.php
      fs.writeFileSync(
        path.join(
          folder,
          `${date.getFullYear()}_${date.getMonth() +
            1}_${date.getDate()}_${date.getHours()}${date.getMinutes()}${date.getSeconds() +
            tableIndex}_create_${databaseTableName}_table.php`
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
    `${tables.length} migrations and ${enumerations.length} enums generated successfully.`
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

exports.init = function init () {
  app.commands.register('laravel:generate', handleLaravelGenerateCommand)
}
