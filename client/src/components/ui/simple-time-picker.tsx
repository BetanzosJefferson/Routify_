import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface SimpleTimePickerProps {
  open: boolean;
  onClose: () => void;
  onSelectTime: (hour: string, minute: string, ampm: "AM" | "PM") => void;
  initialHour?: string;
  initialMinute?: string;
  initialAmPm?: "AM" | "PM";
  title?: string;
}

export function SimpleTimePicker({
  open,
  onClose,
  onSelectTime,
  initialHour = "12",
  initialMinute = "00",
  initialAmPm = "AM",
  title = "Seleccionar Hora"
}: SimpleTimePickerProps) {
  const [hour, setHour] = useState(initialHour);
  const [minute, setMinute] = useState(initialMinute);
  const [ampm, setAmPm] = useState<"AM" | "PM">(initialAmPm);
  const [activeTab, setActiveTab] = useState<"hour" | "minute" | "ampm">("hour");
  
  // Reset to initial values when dialog opens
  useEffect(() => {
    if (open) {
      setHour(initialHour);
      setMinute(initialMinute);
      setAmPm(initialAmPm);
      setActiveTab("hour");
    }
  }, [open, initialHour, initialMinute, initialAmPm]);
  
  const handleConfirm = () => {
    onSelectTime(hour, minute, ampm);
    onClose();
  };

  const handleNowClick = () => {
    const now = new Date();
    let h = now.getHours();
    const isPM = h >= 12;
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    
    setHour(String(h).padStart(2, '0'));
    setMinute(String(now.getMinutes()).padStart(2, '0'));
    setAmPm(isPM ? "PM" : "AM");
  };
  
  const hours = Array.from({ length: 12 }, (_, i) => {
    const num = i + 1;
    return String(num).padStart(2, '0');
  });
  
  const minutes = Array.from({ length: 60 }, (_, i) => {
    return String(i).padStart(2, '0');
  });
  
  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="p-4 border-b">
          <div className="text-center font-medium text-lg mb-1">
            {hour}:{minute} {ampm}
          </div>
          <div className="text-right">
            <Button 
              variant="ghost" 
              className="text-red-500 h-7 px-2 py-1" 
              onClick={handleNowClick}
            >
              NOW
            </Button>
          </div>
        </div>
        
        <div className="flex border-b">
          <div
            className={cn(
              "flex-1 text-center py-3 font-medium cursor-pointer border-b-2",
              activeTab === "hour" ? "border-primary" : "border-transparent"
            )}
            onClick={() => setActiveTab("hour")}
          >
            Hour
          </div>
          <div
            className={cn(
              "flex-1 text-center py-3 font-medium cursor-pointer border-b-2",
              activeTab === "minute" ? "border-primary" : "border-transparent"
            )}
            onClick={() => setActiveTab("minute")}
          >
            Minute
          </div>
          <div
            className={cn(
              "flex-1 text-center py-3 font-medium cursor-pointer border-b-2",
              activeTab === "ampm" ? "border-primary" : "border-transparent"
            )}
            onClick={() => setActiveTab("ampm")}
          >
            AM/PM
          </div>
        </div>
        
        <div className="h-44">
          {activeTab === "hour" && (
            <ScrollArea className="h-full">
              <div className="px-4">
                {hours.map((h) => (
                  <div
                    key={h}
                    className={cn(
                      "p-2 text-center cursor-pointer rounded-sm",
                      hour === h ? "bg-gray-100 font-medium" : ""
                    )}
                    onClick={() => setHour(h)}
                  >
                    {h}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          
          {activeTab === "minute" && (
            <ScrollArea className="h-full">
              <div className="px-4">
                {minutes.map((m) => (
                  <div
                    key={m}
                    className={cn(
                      "p-2 text-center cursor-pointer rounded-sm",
                      minute === m ? "bg-gray-100 font-medium" : ""
                    )}
                    onClick={() => setMinute(m)}
                  >
                    {m}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
          
          {activeTab === "ampm" && (
            <div className="flex flex-col h-full">
              <div
                className={cn(
                  "flex-1 flex items-center justify-center cursor-pointer",
                  ampm === "AM" ? "bg-gray-100 font-medium" : ""
                )}
                onClick={() => setAmPm("AM")}
              >
                AM
              </div>
              <div
                className={cn(
                  "flex-1 flex items-center justify-center cursor-pointer",
                  ampm === "PM" ? "bg-gray-100 font-medium" : ""
                )}
                onClick={() => setAmPm("PM")}
              >
                PM
              </div>
            </div>
          )}
        </div>
        
        <div className="flex border-t">
          <Button 
            variant="ghost" 
            className="flex-1 rounded-none h-14" 
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button 
            variant="ghost" 
            className="flex-1 rounded-none h-14 text-red-500" 
            onClick={handleConfirm}
          >
            Set
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Componente para seleccionar la hora con un campo de entrada y diálogo
export interface SimpleTimeInputProps {
  value: {
    hour: string;
    minute: string;
    ampm: "AM" | "PM";
  };
  onChange: (hour: string, minute: string, ampm: "AM" | "PM") => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SimpleTimeInput({
  value,
  onChange,
  placeholder = "hour:minute AM",
  disabled = false
}: SimpleTimeInputProps) {
  const [open, setOpen] = useState(false);
  
  const handleOpenDialog = () => {
    if (!disabled) {
      setOpen(true);
    }
  };
  
  const handleCloseDialog = () => {
    setOpen(false);
  };
  
  const handleSelectTime = (hour: string, minute: string, ampm: "AM" | "PM") => {
    onChange(hour, minute, ampm);
  };
  
  return (
    <div className="relative">
      <div
        className={cn(
          "border rounded-md p-2 flex items-center cursor-pointer bg-white",
          disabled && "bg-gray-100 cursor-not-allowed opacity-50"
        )}
        onClick={handleOpenDialog}
      >
        <input 
          type="text" 
          value={`${value.hour}:${value.minute} ${value.ampm}`} 
          className="flex-1 border-none focus:outline-none cursor-pointer bg-transparent"
          placeholder={placeholder}
          readOnly
          disabled={disabled}
        />
      </div>
      
      <SimpleTimePicker
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