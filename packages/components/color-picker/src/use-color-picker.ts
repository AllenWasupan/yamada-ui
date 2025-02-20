import { layoutStyleProperties } from "@yamada-ui/core"
import type {
  UIPropGetter,
  CSSUIObject,
  ThemeProps,
  HTMLUIProps,
} from "@yamada-ui/core"
import {
  useFormControlProps,
  getFormControlProperties,
} from "@yamada-ui/form-control"
import type { PopoverProps } from "@yamada-ui/popover"
import { useControllableState } from "@yamada-ui/use-controllable-state"
import { useEyeDropper } from "@yamada-ui/use-eye-dropper"
import { useOutsideClick } from "@yamada-ui/use-outside-click"
import type { ColorFormat, Dict } from "@yamada-ui/utils"
import {
  createContext,
  dataAttr,
  handlerAll,
  mergeRefs,
  pickObject,
  splitObject,
  omitObject,
  getEventRelatedTarget,
  isContains,
  convertColor,
  calcFormat,
  useUpdateEffect,
} from "@yamada-ui/utils"
import type { ChangeEvent, FocusEvent, KeyboardEvent, MouseEvent } from "react"
import { useCallback, useRef, useState } from "react"
import type { ColorSelectorProps } from "./color-selector"
import type { UseColorSelectorBaseProps } from "./use-color-selector"

type ColorSelectorThemeProps = ThemeProps<"ColorSelector">

type ColorPickerContext = { value: string; styles: Record<string, CSSUIObject> }

export const [ColorPickerProvider, useColorPickerContext] =
  createContext<ColorPickerContext>({
    name: "ColorPickerContext",
    errorMessage: `useColorPickerContext returned is 'undefined'. Seems you forgot to wrap the components in "<ColorPicker />"`,
  })

type UseColorPickerOptions = {
  /**
   * The initial value of the color selector.
   */
  defaultColor?: string
  /**
   * If `true`, allows input.
   *
   * @default true
   */
  allowInput?: boolean
  /**
   * A callback function to format the input entered.
   */
  formatInput?: (value: string) => string
  /**
   * If `true`, display the result component.
   *
   * @default false
   */
  withResult?: boolean
  /**
   * If `true` display the eye dropper component.
   *
   * @default false
   */
  withColorSelectorEyeDropper?: boolean
  /**
   * If `true`, the color swatch will be closed when value is selected.
   */
  closeOnSelectSwatch?: boolean
  /**
   * Variant for the color selector component.
   */
  colorSelectorVariant?: ColorSelectorThemeProps["variant"]
  /**
   * Size for the color selector component.
   */
  colorSelectorSize?: ColorSelectorThemeProps["size"]
  /**
   * ColorScheme for the color selector component.
   */
  colorSelectorColorScheme?: ColorSelectorThemeProps["colorScheme"]
  /**
   * Props for color selector component.
   */
  colorSelectorProps?: ColorSelectorProps
}

export type UseColorPickerProps = Omit<
  HTMLUIProps<"input">,
  "size" | "offset" | "value" | "defaultValue" | "onChange"
> &
  Omit<UseColorSelectorBaseProps, "id" | "name"> &
  Omit<
    PopoverProps,
    | "initialFocusRef"
    | "closeOnButton"
    | "isOpen"
    | "trigger"
    | "autoFocus"
    | "restoreFocus"
    | "openDelay"
    | "closeDelay"
  > &
  Pick<
    ColorSelectorProps,
    | "withPicker"
    | "withChannel"
    | "swatchesLabel"
    | "swatches"
    | "swatchesColumns"
  > &
  UseColorPickerOptions

export const useColorPicker = ({
  value: valueProp,
  defaultValue,
  fallbackValue,
  defaultColor,
  onChange: onChangeProp,
  onChangeStart,
  onChangeEnd,
  onSwatchClick,
  formatInput = (value) => value,
  closeOnBlur = true,
  closeOnEsc = true,
  placement = "bottom-start",
  duration = 0.2,
  defaultIsOpen,
  onOpen: onOpenProp,
  onClose: onCloseProp,
  allowInput = true,
  closeOnSelectSwatch,
  format,
  swatchesLabel,
  swatches,
  swatchesColumns,
  withPicker,
  withChannel,
  withResult = false,
  withColorSelectorEyeDropper = false,
  colorSelectorVariant,
  colorSelectorSize,
  colorSelectorColorScheme,
  ...rest
}: UseColorPickerProps) => {
  rest = useFormControlProps(rest)

  const formControlProps = pickObject(
    rest,
    getFormControlProperties({ omit: ["aria-readonly"] }),
  )
  const { disabled, readOnly } = formControlProps
  const computedProps = splitObject(rest, layoutStyleProperties)

  const containerRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLInputElement>(null)

  const { supported: eyeDropperSupported, onOpen: onEyeDropperOpen } =
    useEyeDropper()
  const [value, setValue] = useControllableState({
    value: valueProp,
    defaultValue,
    onChange: onChangeProp,
  })
  const formatRef = useRef<ColorFormat>(
    format ?? calcFormat(value ?? defaultColor ?? ""),
  )
  const isInputFocused = useRef<boolean>(false)
  const [inputValue, setInputValue] = useState<string>(value ?? "")
  const [isOpen, setIsOpen] = useState<boolean>(defaultIsOpen ?? false)
  const isColorSelectorFull = colorSelectorSize === "full"

  const onOpen = useCallback(() => {
    if (disabled || readOnly) return

    setIsOpen(true)

    onOpenProp?.()
  }, [onOpenProp, disabled, readOnly])

  const onClose = useCallback(() => {
    if (!isOpen) return

    const next = convertColor(value, fallbackValue)(formatRef.current)

    setValue((prev) => (!next || prev === next ? prev : next))
    setInputValue(formatInput(next ?? ""))

    setIsOpen(false)

    onCloseProp?.()
  }, [
    formatRef,
    isOpen,
    setValue,
    onCloseProp,
    value,
    formatInput,
    setInputValue,
    fallbackValue,
  ])

  const onContainerClick = useCallback(() => {
    if (isOpen) return

    onOpen()
  }, [isOpen, onOpen])

  const onInputFocus = useCallback(() => {
    isInputFocused.current = true

    if (isOpen) return

    onOpen()
  }, [isOpen, onOpen])

  const onInputBlur = useCallback(() => {
    isInputFocused.current = false
  }, [])

  const onContainerBlur = useCallback(
    (ev: FocusEvent<HTMLDivElement>) => {
      const relatedTarget = getEventRelatedTarget(ev)

      if (isContains(containerRef.current, relatedTarget)) return

      if (!closeOnBlur) return

      if (isOpen) onClose()
    },
    [closeOnBlur, isOpen, onClose],
  )

  const onInputKeyDown = useCallback(
    (ev: KeyboardEvent<HTMLInputElement>) => {
      if (ev.key === " ") ev.key = ev.code

      if (disabled || readOnly) return

      const actions: Record<string, Function | undefined> = {
        Space: !isOpen ? onOpen : undefined,
        Enter: !isOpen ? onOpen : undefined,
        Escape: closeOnEsc ? onClose : undefined,
      }

      const action = actions[ev.key]

      if (!action) return

      ev.preventDefault()
      ev.stopPropagation()
      action()
    },
    [disabled, readOnly, isOpen, onOpen, closeOnEsc, onClose],
  )

  const onInputChange = useCallback(
    (ev: ChangeEvent<HTMLInputElement>) => {
      const value = ev.target.value

      setInputValue(formatInput(value))
      setValue(value)
    },
    [setInputValue, formatInput, setValue],
  )

  const onColorSelectorChange = useCallback(
    (value: string) => {
      setValue(value)

      setTimeout(() => {
        if (!isInputFocused.current) setInputValue(formatInput(value))
      })
    },
    [setValue, formatInput],
  )

  const onEyeDropperClick = useCallback(
    async (ev: MouseEvent<HTMLButtonElement>) => {
      ev.preventDefault()
      ev.stopPropagation()

      try {
        const { sRGBHex } = (await onEyeDropperOpen()) ?? {}

        if (!sRGBHex) return

        onColorSelectorChange(sRGBHex)
      } catch {}
    },
    [onEyeDropperOpen, onColorSelectorChange],
  )

  useOutsideClick({
    ref: containerRef,
    handler: onClose,
    enabled: closeOnBlur,
  })

  useUpdateEffect(() => {
    if (!format) return

    formatRef.current = format

    const nextValue = convertColor(value, fallbackValue)(format)

    if (!nextValue) return

    setInputValue(formatInput(nextValue))
    setValue(nextValue)
  }, [format, fallbackValue])

  const getPopoverProps = useCallback(
    (props?: PopoverProps): PopoverProps => ({
      matchWidth: isColorSelectorFull,
      ...rest,
      ...props,
      isOpen,
      onOpen,
      onClose,
      placement,
      duration,
      trigger: "never",
      closeOnButton: false,
    }),
    [isColorSelectorFull, duration, onClose, onOpen, placement, rest, isOpen],
  )

  const getContainerProps: UIPropGetter = useCallback(
    (props = {}, ref = null) => ({
      ref: mergeRefs(containerRef, ref),
      ...computedProps[0],
      ...props,
      ...formControlProps,
      onClick: handlerAll(props.onClick, rest.onClick, onContainerClick),
      onBlur: handlerAll(props.onBlur, rest.onBlur, onContainerBlur),
    }),
    [computedProps, formControlProps, onContainerBlur, onContainerClick, rest],
  )

  const getFieldProps: UIPropGetter<"input"> = useCallback(
    (props = {}, ref = null) => ({
      ref: mergeRefs(fieldRef, ref),
      tabIndex: !allowInput ? -1 : 0,
      ...omitObject(computedProps[1] as Dict, ["aria-readonly"]),
      ...props,
      style: {
        ...props.style,
        ...(!allowInput ? { pointerEvents: "none" } : {}),
      },
      value: inputValue,
      "data-active": dataAttr(isOpen),
      "aria-expanded": dataAttr(isOpen),
      onFocus: handlerAll(props.onFocus, rest.onFocus, onInputFocus),
      onKeyDown: handlerAll(props.onKeyDown, rest.onKeyDown, onInputKeyDown),
      onChange: handlerAll(props.onChange, onInputChange),
      onBlur: handlerAll(props.onFocus, onInputBlur),
    }),
    [
      allowInput,
      computedProps,
      inputValue,
      isOpen,
      rest,
      onInputFocus,
      onInputKeyDown,
      onInputChange,
      onInputBlur,
    ],
  )

  const getEyeDropperProps: UIPropGetter<"button"> = useCallback(
    (props = {}, ref = null) => ({
      disabled,
      "aria-label": "Pick a color",
      ...props,
      ref,
      style: { ...props.style, pointerEvents: readOnly ? "none" : undefined },
      onClick: handlerAll(props.onClick, onEyeDropperClick),
    }),
    [disabled, onEyeDropperClick, readOnly],
  )

  const getSelectorProps = useCallback(
    (props?: ColorSelectorProps): ColorSelectorProps => ({
      ...formControlProps,
      ...props,
      value,
      defaultValue: defaultColor,
      fallbackValue,
      onChange: onColorSelectorChange,
      onChangeStart,
      onChangeEnd,
      onSwatchClick: handlerAll(
        onSwatchClick,
        closeOnSelectSwatch ? onClose : undefined,
      ),
      format: formatRef.current,
      withPicker,
      withChannel,
      withResult,
      withEyeDropper: withColorSelectorEyeDropper,
      swatchesLabel,
      swatches,
      swatchesColumns,
      variant: colorSelectorVariant,
      size: colorSelectorSize,
      colorScheme: colorSelectorColorScheme,
    }),
    [
      formControlProps,
      value,
      fallbackValue,
      defaultColor,
      onColorSelectorChange,
      onChangeStart,
      onChangeEnd,
      onSwatchClick,
      onClose,
      closeOnSelectSwatch,
      formatRef,
      withPicker,
      withChannel,
      withResult,
      withColorSelectorEyeDropper,
      swatchesLabel,
      swatches,
      swatchesColumns,
      colorSelectorColorScheme,
      colorSelectorSize,
      colorSelectorVariant,
    ],
  )

  return {
    value,
    eyeDropperSupported,
    allowInput,
    getPopoverProps,
    getContainerProps,
    getFieldProps,
    getSelectorProps,
    getEyeDropperProps,
  }
}

export type UseColorPickerReturn = ReturnType<typeof useColorPicker>
