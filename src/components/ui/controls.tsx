import React from "react";
import * as Select from "@radix-ui/react-select";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Check, ChevronDown } from "lucide-react";

type Choice = { value: string; label: string };
type ChoiceProps = {
  label: string;
  value: string;
  options: Choice[];
  disabled?: boolean;
  onChange: (value: string) => void;
};
export function ChoiceSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: ChoiceProps) {
  return (
    <Select.Root value={value} onValueChange={onChange} disabled={disabled}>
      <Select.Trigger aria-label={label} className="choice-trigger">
        <Select.Value placeholder={label} />
        <Select.Icon asChild>
          <ChevronDown />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={5}
          collisionPadding={12}
          className="choice-content"
        >
          <Select.Viewport className="p-1">
            <Select.Group>
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className="choice-item"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Group>
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
export function MicrophoneCheckbox({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Checkbox.Root
        id="microphone"
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onChange(value === true)}
        className="mic-check"
      >
        <Checkbox.Indicator>
          <Check />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <label htmlFor="microphone" className="cursor-pointer font-medium">
        Microphone
      </label>
    </div>
  );
}
