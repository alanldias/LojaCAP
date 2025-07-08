// srv/services.cds
using my.shop as shop from '../db/schema';


service ShopService {

  @odata.draft.enabled
  entity Produtos   as projection on shop.Produto;

  @odata.draft.enabled
  entity Clientes   as projection on shop.Cliente;

  entity Carrinhos  as projection on shop.Carrinho;

  
    entity Pedidos as projection on shop.Pedido {
        *, 
        @Core.Computed 
        statusCriticality : Integer 
    } actions { // <<< Bloco de ações para a entidade Pedidos
        action avancarStatus(); 
        action retrocederStatus();
    }
  
    entity ItemCarrinho as projection on shop.ItemCarrinho;

    entity StatusPedidoEnum as projection on shop.StatusPedidoEnum;

    entity NotaFiscalServicoMonitor as projection on shop.NotaFiscalServicoMonitor;

    entity NotaFiscalServicoLog     as projection on shop.NotaFiscalServicoLog;

    entity ConfiguracoesISS as projection on shop.ZTMM_ISS_CFG;
    @readonly
    entity Empresas as projection on shop.Empresas;

    action uploadArquivoFrete(data: LargeBinary) returns Boolean;
   
    action avancarStatusNFs(
        grpFilho      : String     
    ) returns array of {
        idAlocacaoSAP     : String;
        success           : Boolean;
        message           : String;
        novoStatus        : String;
        numeroNfseServico : String;
    };
    action rejeitarFrete(
        grpFilho      : String
    ) returns array of {
        idAlocacaoSAP : String;
        success       : Boolean;
        message       : String;
        novoStatus    : String;
    };
    
    action registerCliente(nome: String, email: String, senha: String) returns String;
    action loginCliente(email: String, senha: String) returns String;
    action realizarPagamento(clienteID: UUID, tipoPagamento: shop.TipoPagamento) returns UUID;
    action mergeCarrinho(clienteID: UUID, carrinhoAnonimoID: UUID) returns { carrinhoID : UUID };
    action realizarPagamentoItemUnico(
        clienteID     : UUID, // Para associar o Pedido ao Cliente
        tipoPagamento : shop.TipoPagamento,
        produtoID     : UUID,
        quantidade    : Integer,
        precoUnitario : Decimal // Passar o preço unitário do momento da compra
    ) returns UUID;
    action voltarStatusNFs(grpFilho: String, grpStatus: Integer) returns array of {
        idAlocacaoSAP : String;
        success       : Boolean;
        message       : String;
        novoStatus    : String;
    };
  function getPOSubcontractingComponents() returns LargeString;
}