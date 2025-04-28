import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { couponFormSchema } from "@/lib/form-schemas";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Ticket,
  CalendarIcon,
  Plus,
  Loader2,
  BookText,
  BadgePercent,
  X,
  CheckCircle2,
  History,
  ArrowDownUp,
  Filter,
} from "lucide-react";

// Tipo de interfaz para un cupón
interface Coupon {
  id: number;
  code: string;
  discountPercentage: number;
  maxUses: number;
  usedCount: number;
  expirationDate: string;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  companyId: string;
}

// Tipo para el formulario
type CouponFormValues = z.infer<typeof couponFormSchema>;

export default function CouponsPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("active");

  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Gestión de Cupones</h1>
        <Button className="gap-2">
          <Ticket className="h-4 w-4" />
          Nuevo Cupón
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sistema de Cupones</CardTitle>
          <CardDescription>
            Esta funcionalidad estará disponible próximamente. Aquí podrás crear y gestionar 
            cupones de descuento para tus clientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 space-y-6">
          <div className="rounded-full bg-primary/10 p-6">
            <Ticket className="h-12 w-12 text-primary" />
          </div>
          <div className="text-center max-w-md">
            <h3 className="text-xl font-semibold mb-2">Próximamente</h3>
            <p className="text-muted-foreground">
              Estamos trabajando en implementar un completo sistema de cupones que te permitirá:
            </p>
            <ul className="mt-4 text-left space-y-2">
              <li className="flex items-start gap-2">
                <BadgePercent className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                <span>Crear códigos de descuento con diferentes porcentajes</span>
              </li>
              <li className="flex items-start gap-2">
                <CalendarIcon className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                <span>Establecer fechas de expiración personalizadas</span>
              </li>
              <li className="flex items-start gap-2">
                <BookText className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                <span>Limitar el número de usos por cupón</span>
              </li>
              <li className="flex items-start gap-2">
                <History className="h-5 w-5 mt-0.5 text-primary flex-shrink-0" />
                <span>Llevar un registro completo de uso de cada cupón</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}