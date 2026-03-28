import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, AlertCircle, Download } from "lucide-react";
import { useState, useMemo } from "react";

interface PartiallyFlaggedAccount {
  id: string;
  accountId: string;
  layer: number;
  flagCount: number;
  lastFlagDate: string;
  riskScore: number;
  status: "pending" | "under_review" | "cleared";
}

// Synthetic data for partially flagged accounts
const syntheticPartiallyFlaggedAccounts: PartiallyFlaggedAccount[] = [
  {
    id: "pfa001",
    accountId: "ACC-2024-1001",
    layer: 2,
    flagCount: 5,
    lastFlagDate: "2024-03-27",
    riskScore: 65,
    status: "under_review",
  },
  {
    id: "pfa002",
    accountId: "ACC-2024-1002",
    layer: 1,
    flagCount: 3,
    lastFlagDate: "2024-03-26",
    riskScore: 42,
    status: "pending",
  },
  {
    id: "pfa003",
    accountId: "ACC-2024-1003",
    layer: 3,
    flagCount: 8,
    lastFlagDate: "2024-03-25",
    riskScore: 78,
    status: "under_review",
  },
  {
    id: "pfa004",
    accountId: "ACC-2024-1004",
    layer: 2,
    flagCount: 4,
    lastFlagDate: "2024-03-24",
    riskScore: 55,
    status: "pending",
  },
  {
    id: "pfa005",
    accountId: "ACC-2024-1005",
    layer: 1,
    flagCount: 2,
    lastFlagDate: "2024-03-23",
    riskScore: 38,
    status: "cleared",
  },
  {
    id: "pfa006",
    accountId: "ACC-2024-1006",
    layer: 4,
    flagCount: 12,
    lastFlagDate: "2024-03-22",
    riskScore: 89,
    status: "under_review",
  },
  {
    id: "pfa007",
    accountId: "ACC-2024-1007",
    layer: 2,
    flagCount: 6,
    lastFlagDate: "2024-03-21",
    riskScore: 71,
    status: "pending",
  },
  {
    id: "pfa008",
    accountId: "ACC-2024-1008",
    layer: 3,
    flagCount: 7,
    lastFlagDate: "2024-03-20",
    riskScore: 68,
    status: "under_review",
  },
  {
    id: "pfa009",
    accountId: "ACC-2024-1009",
    layer: 1,
    flagCount: 1,
    lastFlagDate: "2024-03-19",
    riskScore: 32,
    status: "cleared",
  },
  {
    id: "pfa010",
    accountId: "ACC-2024-1010",
    layer: 2,
    flagCount: 9,
    lastFlagDate: "2024-03-18",
    riskScore: 82,
    status: "under_review",
  },
];

const getRiskColor = (score: number) => {
  if (score >= 75) return "bg-destructive/15 text-destructive";
  if (score >= 50) return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
  return "bg-green-500/15 text-green-700 dark:text-green-400";
};

export default function PartiallyFlaggedAccounts() {
  const [search, setSearch] = useState("");
  const [accounts, setAccounts] = useState<PartiallyFlaggedAccount[]>(syntheticPartiallyFlaggedAccounts);

  const filtered = useMemo(() => {
    if (!search) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(
      (a) =>
        a.accountId.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q)
    );
  }, [search, accounts]);

  const stats = {
    total: accounts.length,
    underReview: accounts.filter((a) => a.status === "under_review").length,
    flagCountTotal: accounts.reduce((sum, a) => sum + a.flagCount, 0),
  };

  return (
    <div className="space-y-4 animate-slide-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Partially Flagged Accounts</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Accounts with preliminary flags · {stats.total} total ·{" "}
            {stats.underReview} under review
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" /> Export PDF
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Accounts</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Under Review</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{stats.underReview}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Flags</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{stats.flagCountTotal}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by Account ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </CardHeader>
      </Card>

      {/* Table */}
      <Card className="shadow-card overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b">
                <TableHead className="font-semibold">Account ID</TableHead>
                <TableHead className="font-semibold">Layer Terminated</TableHead>
                <TableHead className="font-semibold">Times Flagged</TableHead>
                <TableHead className="font-semibold">Risk Score</TableHead>
                <TableHead className="font-semibold">Last Flag Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">No partially flagged accounts found</p>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((account) => (
                  <TableRow key={account.id} className="border-b hover:bg-muted/50 transition-colors">
                    <TableCell className="text-sm font-mono font-medium text-foreground">{account.accountId}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-semibold">
                        Layer {account.layer}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                          <span className="text-xs font-bold text-red-600">{account.flagCount}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">flags</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${getRiskColor(account.riskScore)}`}>
                        {account.riskScore}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(account.lastFlagDate).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
