import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, DollarSign, Loader2 } from "lucide-react";

const AperturaCaja = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [cajas, setCajas] = useState<any[]>([]);
  const [userId, setUserId] = useState<string>("");
  
  const [formData, setFormData] = useState({
    cajaId: "",
    montoInicial: "",
    observaciones: "",
    fecha: new Date().toISOString().split('T')[0],
    horaInicio: new Date().toTimeString().slice(0, 5),
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);

      // Cargar cajas activas
      const { data: cajasData, error: cajasError } = await supabase
        .from("cajas")
        .select("*")
        .eq("activa", true)
        .eq("tipo", "comercial");

      if (cajasError) throw cajasError;
      setCajas(cajasData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const verificarAperturaActiva = async (cajaId: string) => {
    const { data: turnosActivos } = await supabase
      .from("turnos")
      .select(`
        id,
        aperturas (
          id,
          cerrada
        )
      `)
      .eq("caja_id", cajaId)
      .eq("usuario_id", userId)
      .eq("estado", "abierto");

    if (turnosActivos && turnosActivos.length > 0) {
      const tieneAperturaActiva = turnosActivos.some((turno: any) => 
        turno.aperturas && turno.aperturas.some((apertura: any) => !apertura.cerrada)
      );
      return tieneAperturaActiva;
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validar que no haya apertura activa
      const tieneAperturaActiva = await verificarAperturaActiva(formData.cajaId);
      if (tieneAperturaActiva) {
        toast({
          title: "Apertura activa existente",
          description: "Ya tienes una apertura activa en esta caja. Debes cerrarla antes de abrir un nuevo turno.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Crear turno
      const { data: turno, error: turnoError } = await supabase
        .from("turnos")
        .insert({
          caja_id: formData.cajaId,
          usuario_id: userId,
          fecha: formData.fecha,
          hora_inicio: formData.horaInicio,
          estado: "abierto",
        })
        .select()
        .single();

      if (turnoError) throw turnoError;

      // Crear apertura
      const { error: aperturaError } = await supabase
        .from("aperturas")
        .insert({
          turno_id: turno.id,
          monto_inicial: parseFloat(formData.montoInicial),
          observaciones: formData.observaciones || null,
        });

      if (aperturaError) throw aperturaError;

      toast({
        title: "¡Turno iniciado!",
        description: "La caja ha sido abierta correctamente",
      });

      navigate("/");
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
                <DollarSign className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Apertura de Caja</h1>
                <p className="text-sm text-muted-foreground">Iniciar nuevo turno</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Datos de Apertura</CardTitle>
            <CardDescription>
              Registra el fondo inicial para comenzar el turno
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fecha">Fecha</Label>
                  <Input
                    id="fecha"
                    type="date"
                    value={formData.fecha}
                    onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="horaInicio">Hora de Inicio</Label>
                  <Input
                    id="horaInicio"
                    type="time"
                    value={formData.horaInicio}
                    onChange={(e) => setFormData({ ...formData, horaInicio: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="caja">Caja</Label>
                <Select
                  value={formData.cajaId}
                  onValueChange={(value) => setFormData({ ...formData, cajaId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una caja" />
                  </SelectTrigger>
                  <SelectContent>
                    {cajas.map((caja) => (
                      <SelectItem key={caja.id} value={caja.id}>
                        {caja.nombre} - {caja.ubicacion}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="montoInicial">Monto Inicial (USD)</Label>
                <Input
                  id="montoInicial"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.montoInicial}
                  onChange={(e) => setFormData({ ...formData, montoInicial: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observaciones">Observaciones (Opcional)</Label>
                <Textarea
                  id="observaciones"
                  value={formData.observaciones}
                  onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                  placeholder="Notas adicionales sobre la apertura..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/")}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="flex-1">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Iniciar Turno
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AperturaCaja;
