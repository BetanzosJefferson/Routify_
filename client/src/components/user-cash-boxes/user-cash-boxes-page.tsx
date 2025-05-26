import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Users, DollarSign, CreditCard, Calendar, RefreshCw, Eye, EyeOff, Filter } from "lucide-react"; // Añadido Filter icon
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"; // Importación de Select components

interface Transaction {
    id: number;
    user_id: number;
    details: {
        type: string;
        details: {
            id: number;
            monto: number;
            metodoPago: string;
            pasajeros?: string;
            origen?: string;
            destino?: string;
            remitente?: string;
            destinatario?: string;
            companyId: string;
            dateCreated?: string;
            notas?: string;
            contacto?: {
                email: string | null;
                telefono: string;
            };
        };
    };
    cutoff_id: number | null;
    createdAt: string;
    updatedAt: string;
    companyId: string;
    user: {
        id: number;
        firstName: string;
        lastName: string;
        email: string;
        role: string;
        company: string;
        profilePicture?: string;
        companyId: string;
        commissionPercentage: number;
    };
}

interface UserCashBoxData {
    userId: number;
    userName: string;
    userEmail: string;
    userRole: string;
    userCompany: string;
    userProfilePicture?: string;
    transactions: Transaction[];
    totalCash: number;
    totalTransfer: number;
    totalAmount: number;
    transactionCount: number;
    hasPendingCutoff: boolean;
    allTransactionsCutoff: boolean;
}

export function UserCashBoxesPage() {
    const { toast } = useToast();
    const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set());
    const [showAmounts, setShowAmounts] = useState(true);
    const [selectedUserFilter, setSelectedUserFilter] = useState<string>("all"); // Estado para filtro de usuario
    const [selectedCutoffFilter, setSelectedCutoffFilter] = useState<string>("all"); // Estado para filtro de corte

    const { data: transactions, isLoading, error, refetch } = useQuery({
        queryKey: ["/api/transactions/user-cash-boxes"],
        staleTime: 60000,
        gcTime: 300000,
        queryFn: async () => {
            console.log("[UserCashBoxes] Consultando transacciones de otros usuarios...");
            const response = await fetch("/api/transactions/user-cash-boxes", {
                credentials: "include",
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("[UserCashBoxes] Error en la consulta:", response.status, errorText);
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const data = await response.json() as Transaction[];
            console.log("[UserCashBoxes] Transacciones obtenidas:", data.length);
            return data;
        },
        retry: (failureCount, error) => {
            console.log("[UserCashBoxes] Reintento", failureCount, error);
            return failureCount < 3;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        refetchOnWindowFocus: false,
        refetchOnMount: true,
    });

    const allUserCashBoxes: UserCashBoxData[] = useMemo(() => { // Renombrado a allUserCashBoxes
        if (!transactions || !Array.isArray(transactions)) return [];

        const userGroups = new Map<number, UserCashBoxData>();

        transactions.forEach((transaction) => {
            const userId = transaction.user_id;
            const amount = transaction.details?.details?.monto || 0;
            const paymentMethod = transaction.details?.details?.metodoPago || "efectivo";

            if (!userGroups.has(userId)) {
                userGroups.set(userId, {
                    userId,
                    userName: `Usuario ${userId}`,
                    transactions: [],
                    totalCash: 0,
                    totalTransfer: 0,
                    totalAmount: 0,
                    transactionCount: 0,
                    userEmail: '',
                    userRole: '',
                    userCompany: '',
                    userProfilePicture: '',
                    hasPendingCutoff: false,
                    allTransactionsCutoff: true,
                });
            }

            const userGroup = userGroups.get(userId)!;
            userGroup.transactions.push(transaction);
            userGroup.transactionCount++;
            userGroup.totalAmount += amount;

            if (paymentMethod === "efectivo") {
                userGroup.totalCash += amount;
            } else {
                userGroup.totalTransfer += amount;
            }

            if (transaction.cutoff_id === null) {
                userGroup.hasPendingCutoff = true;
                userGroup.allTransactionsCutoff = false;
            }
        });

        Array.from(userGroups.values()).forEach(userBox => {
            if (userBox.transactions.length > 0 && userBox.transactions[0].user) {
                const firstTransactionUser = userBox.transactions[0].user;
                userBox.userName = `${firstTransactionUser.firstName} ${firstTransactionUser.lastName}`;
                userBox.userEmail = firstTransactionUser.email;
                userBox.userRole = firstTransactionUser.role;
                userBox.userCompany = firstTransactionUser.company;
                userBox.userProfilePicture = firstTransactionUser.profilePicture;
            }
        });

        return Array.from(userGroups.values()).sort((a, b) => b.totalAmount - a.totalAmount);
    }, [transactions]);

    // Aplicar filtros a los userCashBoxes
    const filteredUserCashBoxes: UserCashBoxData[] = useMemo(() => {
        let currentFiltered = allUserCashBoxes;

        if (selectedUserFilter !== "all") {
            currentFiltered = currentFiltered.filter(userBox => userBox.userId.toString() === selectedUserFilter);
        }

        if (selectedCutoffFilter !== "all") {
            currentFiltered = currentFiltered.filter(userBox => {
                if (selectedCutoffFilter === "pending") {
                    return userBox.hasPendingCutoff;
                } else if (selectedCutoffFilter === "completed") {
                    return userBox.allTransactionsCutoff && userBox.transactionCount > 0; // Solo si tienen transacciones
                }
                return true; // Debería ser capturado por 'all' pero para seguridad
            });
        }

        return currentFiltered;
    }, [allUserCashBoxes, selectedUserFilter, selectedCutoffFilter]);


    const toggleUserExpansion = (userId: number) => {
        const newExpanded = new Set(expandedUsers);
        if (newExpanded.has(userId)) {
            newExpanded.delete(userId);
        } else {
            newExpanded.add(userId);
        }
        setExpandedUsers(newExpanded);
    };

    const formatCurrency = (amount: number) => {
        if (!showAmounts) return "****";
        const formattedAmount = Number(amount).toFixed(2);
        return new Intl.NumberFormat('es-MX', {
            style: 'currency',
            currency: 'MXN'
        }).format(Number(formattedAmount));
    };

    const handleRefresh = () => {
        refetch();
        toast({
            title: "Actualizando datos",
            description: "Consultando transacciones más recientes...",
        });
    };

    const toggleAmountVisibility = () => {
        setShowAmounts(!showAmounts);
    };

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString('es-MX', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            console.error("Error formatting date:", dateString, e);
            return "Fecha inválida";
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Cajas de usuarios</h1>
                    <p className="text-muted-foreground">
                        Gestión de cajas individuales por usuario
                    </p>
                </div>
                <div className="flex items-center justify-center h-32">
                    <div className="text-muted-foreground">Cargando datos de cajas de usuarios...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Cajas de usuarios</h1>
                    <p className="text-muted-foreground">
                        Gestión de cajas individuales por usuario
                    </p>
                </div>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error al cargar datos</AlertTitle>
                    <AlertDescription>
                        No se pudieron cargar los datos de las cajas de usuarios. Intenta recargar la página.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Cajas de usuarios</h1>
                    <p className="text-muted-foreground">
                        Gestión de cajas individuales por usuario
                    </p>
                </div>
                <div className="flex items-center space-x-2">
                    {/* Filtro por usuario */}
                    <Select value={selectedUserFilter} onValueChange={setSelectedUserFilter}>
                        <SelectTrigger className="w-[180px] flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder="Filtrar por usuario" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los usuarios</SelectItem>
                            {allUserCashBoxes.map(userBox => (
                                <SelectItem key={userBox.userId} value={userBox.userId.toString()}>
                                    {userBox.userName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Filtro por estado de corte */}
                    <Select value={selectedCutoffFilter} onValueChange={setSelectedCutoffFilter}>
                        <SelectTrigger className="w-[180px] flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <SelectValue placeholder="Estado de corte" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los estados</SelectItem>
                            <SelectItem value="pending">Corte pendiente</SelectItem>
                            <SelectItem value="completed">Corte realizado</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleAmountVisibility}
                        className="flex items-center space-x-2"
                    >
                        {showAmounts ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        <span>{showAmounts ? "Ocultar montos" : "Mostrar montos"}</span>
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={isLoading}
                        className="flex items-center space-x-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>Actualizar</span>
                    </Button>
                </div>
            </div>

            {/* Resumen general */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Usuarios</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{filteredUserCashBoxes.length}</div> {/* Usar filteredUserCashBoxes */}
                        <p className="text-xs text-muted-foreground">
                            {filteredUserCashBoxes.length === 1 ? 'usuario activo' : 'usuarios activos'}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Efectivo</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(filteredUserCashBoxes.reduce((sum, user) => sum + user.totalCash, 0))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Total en efectivo
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Transferencias</CardTitle>
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(filteredUserCashBoxes.reduce((sum, user) => sum + user.totalTransfer, 0))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Total en transferencias
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total General</CardTitle>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {formatCurrency(filteredUserCashBoxes.reduce((sum, user) => sum + user.totalAmount, 0))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {filteredUserCashBoxes.reduce((sum, user) => sum + user.transactionCount, 0)} transacciones
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Lista de usuarios y sus cajas */}
            <Card>
                <CardHeader>
                    <CardTitle>Cajas por Usuario</CardTitle>
                    <CardDescription>
                        Detalle de transacciones y balances por cada usuario
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {filteredUserCashBoxes.length === 0 ? ( // Usar filteredUserCashBoxes
                        <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Sin datos</AlertTitle>
                            <AlertDescription>
                                No se encontraron usuarios o transacciones con los filtros aplicados.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="space-y-4">
                            {filteredUserCashBoxes.map((userBox) => ( // Usar filteredUserCashBoxes
                                <Collapsible key={userBox.userId}>
                                    <div className="border rounded-lg">
                                        <CollapsibleTrigger 
                                            className="w-full p-4 flex items-center justify-between hover:bg-muted/50"
                                            onClick={() => toggleUserExpansion(userBox.userId)}
                                        >
                                            <div className="flex items-center space-x-4">
                                                {expandedUsers.has(userBox.userId) ? (
                                                    <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4" />
                                                )}
                                                <div className="text-left">
                                                    <h3 className="font-semibold flex items-center gap-2">
                                                        {userBox.userName}
                                                        {userBox.hasPendingCutoff ? (
                                                            <Badge 
                                                                style={{ 
                                                                    backgroundColor: '#ffc107', 
                                                                    color: '#333', 
                                                                    fontWeight: 'bold' 
                                                                }}
                                                            >
                                                                Corte pendiente
                                                            </Badge>
                                                        ) : (
                                                            userBox.transactionCount > 0 && (
                                                                <Badge 
                                                                    style={{ 
                                                                        backgroundColor: '#28a745', 
                                                                        color: '#fff', 
                                                                        fontWeight: 'bold' 
                                                                    }}
                                                                >
                                                                    Corte realizado
                                                                </Badge>
                                                            )
                                                        )}
                                                    </h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        {userBox.transactionCount} transacciones
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-4">
                                                <div className="text-right">
                                                    <div className="font-semibold">{formatCurrency(userBox.totalAmount)}</div>
                                                    <div className="text-sm text-muted-foreground">
                                                        Efectivo: {formatCurrency(userBox.totalCash)} | 
                                                        Transferencia: {formatCurrency(userBox.totalTransfer)}
                                                    </div>
                                                </div>
                                            </div>
                                        </CollapsibleTrigger>

                                        <CollapsibleContent>
                                            <div className="border-t p-4">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Fecha</TableHead>
                                                            <TableHead>Tipo</TableHead>
                                                            <TableHead>Detalles</TableHead>
                                                            <TableHead>Método Pago</TableHead>
                                                            <TableHead className="text-right">Monto</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {userBox.transactions.map((transaction) => (
                                                            <TableRow key={transaction.id}>
                                                                <TableCell className="text-sm">
                                                                    {formatDate(transaction.createdAt)}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant={transaction.details.type === 'reservation' ? 'default' : 'secondary'}>
                                                                        {transaction.details.type === 'reservation' ? 'Reservación' : 'Paquetería'}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-sm">
                                                                    {transaction.details.type === 'reservation' ? (
                                                                        <div>
                                                                            <div className="font-medium">{transaction.details.details.pasajeros}</div>
                                                                            <div className="text-muted-foreground">
                                                                                {transaction.details.details.origen} → {transaction.details.details.destino}
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div>
                                                                            <div className="font-medium">
                                                                                {transaction.details.details.remitente} → {transaction.details.details.destinatario}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant={transaction.details.details.metodoPago === 'efectivo' ? 'default' : 'secondary'}>
                                                                        {transaction.details.details.metodoPago}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right font-medium">
                                                                    {formatCurrency(transaction.details.details.monto)}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </CollapsibleContent>
                                    </div>
                                </Collapsible>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}