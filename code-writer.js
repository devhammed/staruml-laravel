/*
 * Copyright (c) 2014 MKLab. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 * Improved by: Hammed Oyedele (2021)
 */

class CodeWriter {
  /**
   * CodeWriter
   * @constructor
   */
  constructor () {
    /** @type {Array<string>} lines */
    this.lines = []

    /** @type {Array<string>} indentations */
    this.indentations = []
  }

  /**
   * Indent.
   */
  indent () {
    this.indentations.push('    ')
  }

  /**
   * Outdent.
   */
  outdent () {
    this.indentations.splice(this.indentations.length - 1, 1)
  }

  /**
   * Write to the last line or just append (by starting a new line of course 😁).
   *
   * @param {string} text
   */
  write (text) {
    const lastLine = this.lines.pop()

    if (lastLine === undefined) {
      this.writeLine(text)
    } else {
      this.lines.push(lastLine + text)
    }
  }

  /**
   * Write a line
   *
   * @param {string} line
   */
  writeLine (line) {
    if (line) {
      this.lines.push(this.indentations.join('') + line)
    } else {
      this.lines.push('')
    }
  }

  /**
   * Write lines
   *
   * @param {Array<string>} lines
   */
  writeLines (lines) {
    lines.forEach(this.writeLine.bind(this))
  }

  /**
   * Return as all string data
   *
   * @return {string}
   */
  getData () {
    return this.lines.join('\n')
  }

  /**
   * Start new migrations file template.
   *
   * @param {string} className
   * @param {string[]} extraHeaders
   * @param {(w: CodeWriter) => {}} up
   * @param {(w: CodeWriter) => {}} down
   */
  migration (className, extraHeaders, up, down) {
    this.lines = []

    this.indentations = []

    this.writeLines(
      ['<?php', ''].concat(extraHeaders, [
        'use Illuminate\\Support\\Facades\\Schema;',
        'use Illuminate\\Database\\Schema\\Blueprint;',
        'use Illuminate\\Database\\Migrations\\Migration;',
        '',
        `class ${className} extends Migration`,
        '{'
      ])
    )

    this.indent()

    this.writeLines([
      '/**',
      ' * Run the migrations.',
      ' *',
      ' * @return void',
      ' */',
      'public function up()',
      '{'
    ])

    this.indent()

    up(this)

    this.outdent()

    this.writeLines([
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

    this.indent()

    down(this)

    this.outdent()

    this.writeLine('}')

    this.outdent()

    this.writeLines(['}', ''])
  }

  /**
   * Create a table modification template.
   *
   * @param {string} name
   * @param {(ww: CodeWriter) => {}} cb
   */
  tableModification (name, cb) {
    this.writeLine(`Schema::table('${name}', function (Blueprint $table) {`)

    this.indent()

    cb(this)

    this.outdent()

    this.writeLine('});')
  }

  /**
   * Add a blank line after definition if index is not last.
   *
   * @param {number} index
   * @param {any[]} array
   */
  addBlankLineIfNotLast (index, array) {
    if (index !== array.length - 1) {
      this.writeLine('')
    }
  }
}

module.exports = CodeWriter
