import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Printer, DollarSign, Package, Users } from "lucide-react";

interface Transaction {
  id: number;
  detalles: {
    type: string;
    amount: number;
    paymentMethod: string;
    details: any;
  };
  user_id: number;
  companyId: string;
  createdAt: string;
  cutoff_id: number | null;
  userName?: string;
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
}

const UsersCashBoxComponent: React.FC = () => {
  const { user } = useAuth();
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>("today");

  // Obtener lista de usuarios de la empresa
  const { data: companyUsers, isLoading: usersLoading } = useQuery({
    queryKey: ['/api/users/company'],
    enabled: !!user?.company,
  });

  // Obtener transacciones de otros usuarios en la empresa
  const { data: transactions, isLoading: transactionsLoading, refetch } = useQuery({
    queryKey: ['/api/transactions/users-company', selectedUser, selectedTimeRange],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedUser !== "all") {
        params.append('selectedUser', selectedUser);
      }
      if (selectedTimeRange !== "all") {
        params.append('selectedTimeRange', selectedTimeRange);
      }
      
      const url = `/api/transactions/users-company${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Error al obtener transacciones');
      return response.json();
    },
    enabled: !!user?.company,
    select: (data) => data || [],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: es });
  };

  const getPaymentMethodLabel = (method: string) => {
    switch(method) {
      case 'cash': return 'Efectivo';
      case 'transfer': return 'Transferencia';
      default: return method;
    }
  };

  const getTransactionTypeLabel = (type: string) => {
    switch(type) {
      case 'reservation': return 'RESERVA';
      case 'reservation-final-payment': return 'RESERVA (Pago final)';
      case 'package': return 'PAQUETE';
      case 'package-final-payment': return 'PAQUETE (Pago final)';
      default: return type.toUpperCase();
    }
  };

  const getUserName = (userId: number) => {
    const foundUser = companyUsers?.find((u: User) => u.id === userId);
    return foundUser ? `${foundUser.firstName} ${foundUser.lastName}` : `Usuario ${userId}`;
  };

  // Calcular totales
  const reservationTransactions = transactions?.filter((t: Transaction) => 
    t.detalles.type === 'reservation' || t.detalles.type === 'reservation-final-payment'
  ) || [];
  
  const packageTransactions = transactions?.filter((t: Transaction) => 
    t.detalles.type === 'package' || t.detalles.type === 'package-final-payment'
  ) || [];

  const cashTotal = transactions?.reduce((sum: number, t: Transaction) => 
    t.detalles.paymentMethod === 'cash' ? sum + t.detalles.amount : sum, 0
  ) || 0;

  const transferTotal = transactions?.reduce((sum: number, t: Transaction) => 
    t.detalles.paymentMethod === 'transfer' ? sum + t.detalles.amount : sum, 0
  ) || 0;

  const totalAmount = cashTotal + transferTotal;

  if (!user || (user.role !== "dueño" && user.role !== "admin")) {
    return (
      <div className="flex justify-center items-center h-64">
        <p>No tiene permisos para acceder a esta sección</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Filtros de consulta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Usuario</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los usuarios</SelectItem>
                  {companyUsers?.filter((u: User) => u.id !== user.id).map((u: User) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.firstName} {u.lastName} ({u.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Período</label>
              <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="week">Esta semana</SelectItem>
                  <SelectItem value="month">Este mes</SelectItem>
                  <SelectItem value="all">Todos los períodos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen de totales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total general</p>
                <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Efectivo</p>
                <p className="text-2xl font-bold">{formatCurrency(cashTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Transferencias</p>
                <p className="text-2xl font-bold">{formatCurrency(transferTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Transacciones</p>
                <p className="text-2xl font-bold">{transactions?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de transacciones */}
      <Card>
        <CardHeader>
          <CardTitle>Transacciones de usuarios</CardTitle>
        </CardHeader>
        <CardContent>
          {transactionsLoading ? (
            <div className="flex justify-center py-8">
              <p>Cargando transacciones...</p>
            </div>
          ) : transactions?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No hay transacciones para mostrar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions?.map((transaction: Transaction) => (
                <div key={transaction.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">
                          {getTransactionTypeLabel(transaction.detalles.type)}
                        </Badge>
                        <Badge variant={transaction.detalles.paymentMethod === 'cash' ? 'default' : 'secondary'}>
                          {getPaymentMethodLabel(transaction.detalles.paymentMethod)}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          por {getUserName(transaction.user_id)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p><strong>Fecha:</strong> {formatDate(transaction.createdAt)}</p>
                          <p><strong>Monto:</strong> {formatCurrency(transaction.detalles.amount)}</p>
                        </div>
                        
                        {transaction.detalles.details && (
                          <div>
                            {transaction.detalles.type.includes('reservation') ? (
                              <>
                                <p><strong>Origen:</strong> {transaction.detalles.details.origin}</p>
                                <p><strong>Destino:</strong> {transaction.detalles.details.destination}</p>
                              </>
                            ) : (
                              <>
                                <p><strong>Remitente:</strong> {transaction.detalles.details.remitente}</p>
                                <p><strong>Destinatario:</strong> {transaction.detalles.details.destinatario}</p>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(transaction.detalles.amount)}
                      </p>
                      {transaction.cutoff_id && (
                        <p className="text-xs text-gray-500">
                          Corte #{transaction.cutoff_id}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UsersCashBoxComponent;