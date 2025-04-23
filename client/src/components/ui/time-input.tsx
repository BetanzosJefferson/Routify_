import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { TimePicker } from "@/components/ui/time-picker";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";
import { FormControl } from "@/components/ui/form";

type TimeInputProps = {
  value: {
    hour: string;
    minute: string;
    ampm: "AM" | "PM";
  };
  onChange: (hour: string, minute: string, ampm: "AM" | "PM") => void;
  label?: string;
  className?: string;
  disabled?: boolean;
};

export function TimeInput({
  value,
  onChange,
  label,
  className,
  disabled = false,
}: TimeInputProps) {
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  
  const handleOpenTimePicker = () => {
    if (!disabled) {
      setTimePickerOpen(true);
    }
  };
  
  const handleTimeSelected = (hour: string, minute: string, ampm: "AM" | "PM") => {
    onChange(hour, minute, ampm);
  };
  
  const displayTime = `${value.hour}:${value.minute} ${value.ampm}`;
  
  return (
    <div className={cn("flex flex-col", className)}>
      {label && <label className="text-sm font-medium mb-1">{label}</label>}
      
      <FormControl>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full flex justify-between items-center",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          onClick={handleOpenTimePicker}
          disabled={disabled}
        >
          <span>{displayTime}</span>
          <Clock className="ml-2 h-4 w-4" />
        </Button>
      </FormControl>
      
      <TimePicker
        open={timePickerOpen}
        onClose={() => setTimePickerOpen(false)}
        onSelectTime={handleTimeSelected}
        initialHour={value.hour}
        initialMinute={value.minute}
        initialAmPm={value.ampm}
      />
    </div>
  );
}