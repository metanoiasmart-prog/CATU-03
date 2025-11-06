import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileText, Loader2, Filter } from "lucide-react";

const Historial = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [operaciones, setOperaciones] = useState<any[]>([]);
  
  const [filtros, setFiltros] = useState({
    tipoOperacion: "todas",
    fechaInicio: "",
    fechaFin: "",
    estado: "todos",
  });

  useEffect(() => {
    loadOperaciones();
  }, [filtros]);

  const loadOperaciones = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      let operacionesArray: any[] = [];

      // Cargar aperturas
      if (filtros.tipoOperacion === "todas" || filtros.tipoOperacion === "aperturas") {
        const { data: aperturasData } = await supabase
          .from("aperturas")
          .select(`
            id,
            monto_inicial,
            fecha_hora,
            cerrada,
            turnos!inner(
              cajas(nombre),
              profiles(nombre_completo)
            )
          `)
          .order("fecha_hora", { ascending: false })
          .limit(50);

        if (aperturasData) {
          operacionesArray.push(...aperturasData.map((a: any) => ({
            id: a.id,
            tipo: "Apertura",
            fecha: a.fecha_hora,
            monto: a.monto_inicial,
            estado: a.cerrada ? "Cerrada" : "Activa",
            caja: a.turnos.cajas.nombre,
            usuario: a.turnos.profiles.nombre_completo,
          })));
        }
      }

      // Cargar arqueos
      if (filtros.tipoOperacion === "todas" || filtros.tipoOperacion === "arqueos") {
        const { data: arqueosData } = await supabase
          .from("arqueos")
          .select(`
            id,
            monto_contado,
            diferencia,
            fecha_hora,
            aperturas!inner(
              turnos!inner(
                cajas(nombre),
                profiles(nombre_completo)
              )
            )
          `)
          .order("fecha_hora", { ascending: false })
          .limit(50);

        if (arqueosData) {
          operacionesArray.push(...arqueosData.map((a: any) => ({
            id: a.id,
            tipo: "Arqueo",
            fecha: a.fecha_hora,
            monto: a.monto_contado,
            diferencia: a.diferencia,
            estado: a.diferencia === 0 ? "Sin diferencia" : "Con diferencia",
            caja: a.aperturas.turnos.cajas.nombre,
            usuario: a.aperturas.turnos.profiles.nombre_completo,
          })));
        }
      }

      // Cargar traslados
      if (filtros.tipoOperacion === "todas" || filtros.tipoOperacion === "traslados") {
        const { data: trasladosData } = await supabase
          .from("traslados")
          .select(`
            id,
            monto,
            estado,
            fecha_hora_envio,
            caja_origen:cajas!traslados_caja_origen_id_fkey(nombre),
            caja_destino:cajas!traslados_caja_destino_id_fkey(nombre),
            arqueos!inner(
              aperturas!inner(
                turnos!inner(
                  profiles(nombre_completo)
                )
              )
            )
          `)
          .order("fecha_hora_envio", { ascending: false })
          .limit(50);

        if (trasladosData) {
          operacionesArray.push(...trasladosData.map((t: any) => ({
            id: t.id,
            tipo: "Traslado",
            fecha: t.fecha_hora_envio,
            monto: t.monto,
            estado: t.estado === "en_transito" ? "En tránsito" : t.estado === "recibido" ? "Recibido" : "Observado",
            caja: `${t.caja_origen.nombre} → ${t.caja_destino.nombre}`,
            usuario: t.arqueos.aperturas.turnos.profiles.nombre_completo,
          })));
        }
      }

      // Cargar recepciones
      if (filtros.tipoOperacion === "todas" || filtros.tipoOperacion === "recepciones") {
        const { data: recepcionesData } = await supabase
          .from("recepciones")
          .select(`
            id,
            monto_recibido,
            diferencia,
            fecha_hora,
            profiles!recepciones_usuario_receptor_id_fkey(nombre_completo),
            traslados!inner(
              caja_destino:cajas!traslados_caja_destino_id_fkey(nombre)
            )
          `)
          .order("fecha_hora", { ascending: false })
          .limit(50);

        if (recepcionesData) {
          operacionesArray.push(...recepcionesData.map((r: any) => ({
            id: r.id,
            tipo: "Recepción",
            fecha: r.fecha_hora,
            monto: r.monto_recibido,
            diferencia: r.diferencia,
            estado: r.diferencia === 0 ? "Sin diferencia" : "Con diferencia",
            caja: r.traslados.caja_destino.nombre,
            usuario: r.profiles.nombre_completo,
          })));
        }
      }

      // Ordenar por fecha
      operacionesArray.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

      // Aplicar filtros de fecha
      if (filtros.fechaInicio) {
        operacionesArray = operacionesArray.filter(op => 
          new Date(op.fecha) >= new Date(filtros.fechaInicio)
        );
      }
      if (filtros.fechaFin) {
        operacionesArray = operacionesArray.filter(op => 
          new Date(op.fecha) <= new Date(filtros.fechaFin + "T23:59:59")
        );
      }

      // Aplicar filtro de estado
      if (filtros.estado !== "todos") {
        operacionesArray = operacionesArray.filter(op => 
          op.estado.toLowerCase().includes(filtros.estado.toLowerCase())
        );
      }

      setOperaciones(operacionesArray);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getEstadoBadge = (estado: string) => {
    const variants: any = {
      "Activa": "default",
      "Cerrada": "secondary",
      "Sin diferencia": "secondary",
      "Con diferencia": "destructive",
      "En tránsito": "default",
      "Recibido": "secondary",
      "Observado": "destructive",
    };
    return <Badge variant={variants[estado] || "default"}>{estado}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary rounded-lg">
                <FileText className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Historial de Operaciones</h1>
                <p className="text-sm text-muted-foreground">
                  {operaciones.length} operaciones encontradas
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Operación</Label>
                <Select
                  value={filtros.tipoOperacion}
                  onValueChange={(value) => setFiltros({ ...filtros, tipoOperacion: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas</SelectItem>
                    <SelectItem value="aperturas">Aperturas</SelectItem>
                    <SelectItem value="arqueos">Arqueos</SelectItem>
                    <SelectItem value="traslados">Traslados</SelectItem>
                    <SelectItem value="recepciones">Recepciones</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fecha Inicio</Label>
                <Input
                  type="date"
                  value={filtros.fechaInicio}
                  onChange={(e) => setFiltros({ ...filtros, fechaInicio: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Fecha Fin</Label>
                <Input
                  type="date"
                  value={filtros.fechaFin}
                  onChange={(e) => setFiltros({ ...filtros, fechaFin: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Estado</Label>
                <Select
                  value={filtros.estado}
                  onValueChange={(value) => setFiltros({ ...filtros, estado: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="activa">Activa</SelectItem>
                    <SelectItem value="cerrada">Cerrada</SelectItem>
                    <SelectItem value="diferencia">Con diferencia</SelectItem>
                    <SelectItem value="transito">En tránsito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha y Hora</TableHead>
                    <TableHead>Caja</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operaciones.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No se encontraron operaciones
                      </TableCell>
                    </TableRow>
                  ) : (
                    operaciones.map((op) => (
                      <TableRow key={`${op.tipo}-${op.id}`}>
                        <TableCell className="font-medium">{op.tipo}</TableCell>
                        <TableCell>{new Date(op.fecha).toLocaleString()}</TableCell>
                        <TableCell>{op.caja}</TableCell>
                        <TableCell>{op.usuario}</TableCell>
                        <TableCell className="text-right">${op.monto.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          {op.diferencia !== undefined ? (
                            <span className={op.diferencia !== 0 ? "text-destructive font-medium" : ""}>
                              ${op.diferencia.toFixed(2)}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{getEstadoBadge(op.estado)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Historial;
