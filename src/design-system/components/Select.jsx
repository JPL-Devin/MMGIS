import React from 'react'
import * as BaseSelect from '@base-ui-components/react/select'
import './styles/Select.css'

function Select(props) {
    const { options = [], placeholder = 'Select...', className = '', ...rest } = props
    return (
        <BaseSelect.Root {...rest}>
            <BaseSelect.Trigger className={`ds-select-trigger ${className}`}>
                <BaseSelect.Value placeholder={placeholder} />
                <span className="ds-select-arrow mdi mdi-chevron-down" />
            </BaseSelect.Trigger>
            <BaseSelect.Portal>
                <BaseSelect.Positioner>
                    <BaseSelect.Popup className="ds-select-popup">
                        {options.map((opt) => {
                            const val = typeof opt === 'string' ? opt : opt.value
                            const label = typeof opt === 'string' ? opt : opt.label
                            return (
                                <BaseSelect.Option
                                    key={val}
                                    value={val}
                                    className="ds-select-option"
                                >
                                    <BaseSelect.OptionIndicator>
                                        <span className="mdi mdi-check" style={{ marginRight: 4 }} />
                                    </BaseSelect.OptionIndicator>
                                    <BaseSelect.OptionText>{label}</BaseSelect.OptionText>
                                </BaseSelect.Option>
                            )
                        })}
                    </BaseSelect.Popup>
                </BaseSelect.Positioner>
            </BaseSelect.Portal>
        </BaseSelect.Root>
    )
}

export default Select
