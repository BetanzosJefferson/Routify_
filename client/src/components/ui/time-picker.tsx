import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TimePickerProps = {
  open: boolean;
  onClose: () => void;
  onSelectTime: (hour: string, minute: string, ampm: "AM" | "PM") => void;
  initialHour?: string;
  initialMinute?: string;
  initialAmPm?: "AM" | "PM";
  title?: string;
};

type ClockView = "hour" | "minute";

export function TimePicker({
  open,
  onClose,
  onSelectTime,
  initialHour = "07",
  initialMinute = "00",
  initialAmPm = "AM",
  title = "Seleccionar Hora"
}: TimePickerProps) {
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);
  const [ampm, setAmPm] = useState<"AM" | "PM">(initialAmPm);
  const [view, setView] = useState<ClockView>("hour");
  
  // Reset to initial values when dialog opens
  useEffect(() => {
    if (open) {
      setHour(initialHour);
      setMinute(initialMinute);
      setAmPm(initialAmPm);
      setView("hour"); // Reset view to hour when dialog opens
    }
  }, [open, initialHour, initialMinute, initialAmPm]);
  
  const handleHourChange = (newHour: string) => {
    const numHour = parseInt(newHour, 10);
    if (numHour >= 1 && numHour <= 12) {
      setHour(newHour.padStart(2, '0'));
      // Automatically switch to minute view after selecting hour
      setView("minute");
    }
  };
  
  const handleMinuteChange = (newMinute: string) => {
    const numMinute = parseInt(newMinute, 10);
    if (numMinute >= 0 && numMinute <= 59) {
      setMinute(newMinute.padStart(2, '0'));
    }
  };
  
  const handleAmPmToggle = () => {
    setAmPm(ampm === "AM" ? "PM" : "AM");
  };
  
  const handleConfirm = () => {
    onSelectTime(hour, minute, ampm);
    onClose();
  };
  
  // Clock numbers based on view
  const clockNumbers = view === "hour" 
    ? Array.from({ length: 12 }, (_, i) => i + 1) 
    : [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  
  // Calculate hand position for analog clock
  const getHandStyle = () => {
    if (view === "hour") {
      const hourNumber = parseInt(hour, 10) % 12;
      const angle = (hourNumber * 30) - 90; // 30 degrees per hour, -90 to start at 12
      return {
        transform: `rotate(${angle}deg)`,
      };
    } else {
      const minuteNumber = parseInt(minute, 10);
      const angle = (minuteNumber * 6) - 90; // 6 degrees per minute, -90 to start at 12
      return {
        transform: `rotate(${angle}deg)`,
      };
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-[425px]" aria-describedby="time-picker-description">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p id="time-picker-description" className="text-sm text-muted-foreground">
            Selecciona la hora utilizando el reloj o los controles numéricos.
          </p>
        </DialogHeader>
        
        <div className="flex flex-col items-center p-4">
          {/* Digital Display */}
          <div className="flex items-center justify-center mb-6 gap-1">
            <div 
              className={cn(
                "px-4 py-2 rounded-md text-3xl font-bold w-20 text-center cursor-pointer",
                view === "hour" ? "bg-primary text-white" : "bg-gray-100"
              )}
              onClick={() => {
                setView("hour");
                document.getElementById('hour-input')?.focus();
              }}
            >
              {hour}
            </div>
            <span className="text-3xl font-bold">:</span>
            <div 
              className={cn(
                "px-4 py-2 rounded-md text-3xl font-bold w-20 text-center cursor-pointer",
                view === "minute" ? "bg-primary text-white" : "bg-gray-100"
              )}
              onClick={() => {
                setView("minute");
                document.getElementById('minute-input')?.focus();
              }}
            >
              {minute}
            </div>
            <div className="flex flex-col bg-gray-100 rounded-md overflow-hidden">
              <button
                className={cn(
                  "px-2 py-1 text-sm font-medium",
                  ampm === "AM" ? "bg-primary text-white" : "hover:bg-gray-200"
                )}
                onClick={() => setAmPm("AM")}
              >
                AM
              </button>
              <button
                className={cn(
                  "px-2 py-1 text-sm font-medium",
                  ampm === "PM" ? "bg-primary text-white" : "hover:bg-gray-200"
                )}
                onClick={() => setAmPm("PM")}
              >
                PM
              </button>
            </div>
          </div>
          
          {/* View switch tabs */}
          <div className="flex justify-center mb-2 space-x-4">
            <button
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                view === "hour" ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-100"
              )}
              onClick={() => setView("hour")}
            >
              Horas
            </button>
            <button
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                view === "minute" ? "bg-primary text-white" : "text-gray-500 hover:bg-gray-100"
              )}
              onClick={() => setView("minute")}
            >
              Minutos
            </button>
          </div>
          
          {/* Analog Clock */}
          <div className="relative w-48 h-48 rounded-full bg-gray-100 mb-6">
            {/* Clock numbers */}
            {clockNumbers.map((num) => {
              // Different calculation based on if it's hour or minute
              const divider = view === "hour" ? 30 : 6; // 30 degrees per hour, 6 degrees per 5 mins
              const angle = (num * divider) - 90; // -90 to start at 12
              const radian = angle * (Math.PI / 180);
              const x = Math.cos(radian) * 70 + 96; // 70 is radius, 96 is center
              const y = Math.sin(radian) * 70 + 96;
              
              const isSelected = view === "hour" 
                ? parseInt(hour, 10) === num 
                : parseInt(minute, 10) === num;
              
              return (
                <div
                  key={num}
                  className={cn(
                    "absolute transform -translate-x-1/2 -translate-y-1/2 text-sm font-medium cursor-pointer",
                    isSelected ? "text-primary font-bold" : "text-gray-700"
                  )}
                  style={{ left: `${x}px`, top: `${y}px` }}
                  onClick={() => view === "hour" 
                    ? handleHourChange(num.toString()) 
                    : handleMinuteChange(num.toString())}
                >
                  {num}
                </div>
              );
            })}
            
            {/* Clock Hand */}
            <div 
              className="absolute top-1/2 left-1/2 w-1 h-16 bg-primary rounded-full origin-bottom"
              style={getHandStyle()}
            >
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 -translate-y-4 w-6 h-6 rounded-full bg-primary"></div>
            </div>
            
            {/* Center */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-gray-700"></div>
          </div>
          
          {/* Hidden inputs for keyboard input */}
          <input
            id="hour-input"
            type="number"
            className="sr-only"
            min="1"
            max="12"
            value={parseInt(hour, 10)}
            onChange={(e) => handleHourChange(e.target.value)}
          />
          <input
            id="minute-input"
            type="number"
            className="sr-only"
            min="0"
            max="59"
            value={parseInt(minute, 10)}
            onChange={(e) => handleMinuteChange(e.target.value)}
          />
          
          {/* Action Buttons */}
          <div className="flex justify-end w-full gap-2 mt-4">
            <Button variant="outline" onClick={onClose}>
              CANCELAR
            </Button>
            <Button className="text-primary" variant="ghost" onClick={handleConfirm}>
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}