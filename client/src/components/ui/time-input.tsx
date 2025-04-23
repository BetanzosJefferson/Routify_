import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { TimePicker } from "@/components/ui/time-picker";
import { ClockIcon } from "lucide-react";

type TimeInputProps = {
  value: {
    hour: string;
    minute: string;
    ampm: "AM" | "PM";
  };
  onChange: (hour: string, minute: string, ampm: "AM" | "PM") => void;
  label?: string;
  labelPosition?: "top" | "left";
  className?: string;
};

export function TimeInput({
  value,
  onChange,
  label,
  labelPosition = "top",
  className = "",
}: TimeInputProps) {
  const [open, setOpen] = useState(false);

  const handleOpenDialog = () => {
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
  };

  const handleSelectTime = (hour: string, minute: string, ampm: "AM" | "PM") => {
    onChange(hour, minute, ampm);
    setOpen(false);
  };

  return (
    <div className={`flex ${labelPosition === "left" ? "flex-row items-center gap-2" : "flex-col"} ${className}`}>
      {label && (
        <label className={`text-sm font-medium text-gray-700 ${labelPosition === "top" ? "mb-1" : ""}`}>
          {label}
        </label>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleOpenDialog}
        className="border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400"
      >
        <ClockIcon className="h-4 w-4 mr-1.5 text-gray-500" />
        {value.hour}:{value.minute} {value.ampm}
      </Button>

      <TimePicker
        open={open}
        onClose={handleCloseDialog}
        onSelectTime={handleSelectTime}
        initialHour={value.hour}
        initialMinute={value.minute}
        initialAmPm={value.ampm}
      />
    </div>
  );
}