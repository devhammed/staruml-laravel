module.exports = `<?php

namespace App\\Enums;

use ReflectionClass;

abstract class BaseEnum
{
    /**
     * Store existing constants in a static cache per object.
     *
     *
     * @var array
     */
    protected static $cache = [];

    /**
     * Get an array of constants in class. Constant name in key, constant value in value.
     *
     * @return array
     */
    public static function pairs()
    {
        $class = static::class;

        if (!isset(static::$cache[$class])) {
            static::$cache[$class] = (new ReflectionClass($class))->getConstants();
        }

        return static::$cache[$class];
    }


    /**
     * Get array containing keys of constants in this class.
     *
     * @return array
     */
    public static function keys()
    {
        return \\array_keys(static::pairs());
    }

    /**
     * Get array containing values of constants in this class.
     *
     * @return array
     */
    public static function values()
    {
        return \\array_values(static::pairs());
    }

    /**
     * Check if value is a valid key.
     */
    public static function isValidKey($value, $strict = \\false)
    {
        return \\in_array($value, static::keys(), $strict);
    }

    /**
     * Check if value is a valid value.
     */
    public static function isValidValue($value, $strict = \\false)
    {
        return \\in_array($value, static::values(), $strict);
    }

    /**
     * Check if value is a valid key or value.
     *
     * @param mixed $valueOrKey
     * @return boolean
     */
    public static function isValid($valueOrKey)
    {
        return static::isValidKey($valueOrKey) || static::isValidValue($valueOrKey);
    }
}
`
