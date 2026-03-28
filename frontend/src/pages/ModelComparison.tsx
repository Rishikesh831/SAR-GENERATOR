import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, ArrowLeftRight, FileText, BrainCircuit, Activity, AlertTriangle, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Define the layers of the SAR generation process
const layers = [
  { id: 0, name: "Initial Triage & Alert Ingestion" },
  { id: 1, name: "Data Intake + Preprocessing" },
  { id: 2, name: "Graph Build & Clustering" },
  { id: 3, name: "ML Risk Scoring & Enrichment" },
  { id: 4, name: "Deep Entity Corroboration" },
  { id: 5, name: "Dynamic Typology Matching" },
  { id: 6, name: "Final Risk Composite Scoring" },
  { id: 7, name: "Generating Full SAR Narrative & Output" },
];

const MODELS = [
  { id: "llama-3.1", name: "Llama 3.1", terminatesAt: null, description: "Highly efficient orchestrated analytical architecture with full context retention." },
  { id: "llama-3.2", name: "Llama 3.2", terminatesAt: null, description: "Superior context boundary maintenance for complex graph reasoning." },
  { id: "minmax-2.5", name: "MinMax 2.5", terminatesAt: 4, description: "Limited contextual threshold engines; drops relationships in deep layers." },
  { id: "gwen-3.5", name: "Gwen 3.5", terminatesAt: 4, description: "Struggles with cross-entity multi-hop link propagation." },
];

export default function ModelComparison() {
  const [leftModelId, setLeftModelId] = useState("llama-3.1");
  const [rightModelId, setRightModelId] = useState("minmax-2.5");

  const buildColumn = (modelId: string, setModelId: (val: string) => void) => {
    const model = MODELS.find(m => m.id === modelId) || MODELS[0];
    const isSuccessModel = model.terminatesAt === null;
    
    return (
      <Card className={cn(
        "shadow-card h-full transition-colors flex flex-col",
        isSuccessModel ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"
      )}>
        <CardHeader className="pb-4 border-b border-border/50 shrink-0">
          <div className="flex items-center justify-between gap-3 mb-4">
             <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", isSuccessModel ? "bg-success/20" : "bg-destructive/20")}>
                {isSuccessModel ? <BrainCircuit className="w-5 h-5 text-success" /> : <Activity className="w-5 h-5 text-destructive" />}
              </div>
              <div>
                <CardTitle className={cn("text-lg font-bold", isSuccessModel ? "text-success" : "text-destructive")}>
                  {model.name}
                </CardTitle>
              </div>
            </div>
            <div className="shrink-0 z-20">
              <Select value={modelId} onValueChange={setModelId}>
                <SelectTrigger className="w-[140px] h-8 text-xs bg-background">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map(m => (
                    <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs font-medium text-muted-foreground line-clamp-2 min-h-[32px]">
            {model.description}
          </p>
        </CardHeader>

        <CardContent className="space-y-4 pt-4 flex-1 flex flex-col">
          <div className="space-y-3 relative flex-1">
            {/* Connecting line */}
            <div className={cn("absolute left-[13px] top-6 bottom-6 w-px", isSuccessModel ? "bg-success/30" : "bg-border")} />
            {layers.map((layer) => {
               // A layer fails if model has a terminatesAt and layer.id >= model.terminatesAt
               const isLayerFailed = model.terminatesAt !== null && layer.id >= model.terminatesAt;
               const isExactFailLayer = model.terminatesAt !== null && layer.id === model.terminatesAt;
               const isSuccess = !isLayerFailed;

               return (
                 <div key={layer.id} className={cn(
                   "flex items-start gap-4 relative z-10 transition-opacity",
                   isLayerFailed && !isExactFailLayer && "opacity-40"
                 )}>
                   {isSuccess ? (
                     <div className={cn("w-7 h-7 rounded-full border flex items-center justify-center shrink-0 shadow-sm transition-colors",
                        isSuccessModel ? "bg-success border-success/50" : "bg-muted border-border"
                     )}>
                       <CheckCircle className={cn("w-4 h-4", isSuccessModel ? "text-white" : "text-success")} />
                     </div>
                   ) : (
                     <div className="w-7 h-7 rounded-full bg-destructive/10 border border-destructive/30 flex items-center justify-center shrink-0 mt-0.5">
                       <XCircle className="w-4 h-4 text-destructive" />
                     </div>
                   )}
                   
                   <div className={cn(
                     "flex-1 border rounded-lg p-2.5 transition-colors",
                     isSuccess ? "bg-background/50" : "bg-destructive/10 border-destructive/20",
                     isSuccess && isSuccessModel ? "border-success/20" : "border-border"
                   )}>
                     <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">Layer {layer.id}</p>
                     <p className={cn(
                       "text-sm font-semibold",
                       isSuccess ? "text-foreground" : "text-destructive line-through"
                     )}>{layer.name}</p>
                     
                     {isExactFailLayer && (
                       <div className="mt-2 p-2.5 rounded bg-background border border-destructive/30 flex gap-2 items-start shadow-sm">
                         <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                         <p className="text-[11.5px] text-destructive font-medium leading-relaxed">
                           Layer {layer.id} has been terminated due to Unable to carry out the threshold needed to generate SAR.
                         </p>
                       </div>
                     )}
                   </div>

                   <div className={cn(
                     "shrink-0 w-12 text-center font-medium text-xs py-2",
                     isSuccess ? "text-success" : "text-destructive font-mono font-bold text-lg"
                   )}>
                      {isSuccess ? "PASS" : "—"}
                   </div>
                 </div>
               );
            })}
          </div>
          
          <div className={cn(
            "mt-6 pt-4 border-t flex flex-col items-center text-center shrink-0 min-h-[100px] justify-center",
            isSuccessModel ? "border-success/20" : "border-destructive/20"
          )}>
            {isSuccessModel ? (
              <>
                 <FileText className="w-8 h-8 text-success mb-2" />
                 <p className="font-bold text-success text-sm">Full SAR Generated Successfully</p>
                 <p className="text-xs text-muted-foreground mt-1">Maximum contextual correlation achieved.</p>
              </>
            ) : (
              <>
                <AlertTriangle className="w-8 h-8 text-destructive mb-2" />
                <p className="font-bold text-destructive text-sm">Process Terminated</p>
                <p className="text-xs text-destructive/80 mt-1">Data never proceeds. No intelligence generated.</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 animate-slide-in pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ArrowLeftRight className="w-6 h-6 text-primary" />
            Model Layer Success Comparison
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analyzing success rates at each processing layer prior to final Subject Activity Report (SAR) generation
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-7xl">
        {buildColumn(leftModelId, setLeftModelId)}
        {buildColumn(rightModelId, setRightModelId)}
      </div>
    </div>
  );
}
